/**
 * 営業スケジュールの解決と、予約枠の妥当性検証
 *
 * これまで営業時間は「スロット一覧を生成する読み取り経路」にしか存在せず、
 * 予約を作成する書き込み経路（ゲストAPI / 会員saga）はどちらも検証していなかった。
 * そのためUIを経由せず直接POSTすれば休業日・営業時間外・休憩時間中でも予約できた。
 * DB側にもトリガや制約は無い。
 *
 * このモジュールが解決と検証の単一の情報源になる。スロット生成
 * (src/app/api/public/slots/week/route.ts) と同じ関数を使うことで、
 * 「UIに出ているのに予約が拒否される」乖離を防ぐ。
 */

import { getSupabaseServiceRole } from "@/lib/supabase/service-role"
import { isJapaneseHoliday } from "@/lib/utils/holidays"
import { getBookingMinHoursAhead } from "@/lib/settings/app-settings"

/** スロット生成の刻み幅。slots/week/route.ts の `time += 30` と揃える */
export const SLOT_INTERVAL_MINUTES = 30

/** メニュー指定が無い場合の予約時間（ゲスト予約は30分固定） */
export const DEFAULT_DURATION_MINUTES = 30

/** JSTはDSTを持たないUTC+9固定 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

export type ActiveSchedule = {
  day_of_week: number
  start_time: string
  end_time: string
  is_holiday_pattern: boolean
  break_start_time: string | null
  break_end_time: string | null
}

export type ScheduleSet = {
  weekday: ActiveSchedule[]
  holiday: ActiveSchedule | null
}

export type SlotValidationResult = {
  valid: boolean
  errors: string[]
  code?: string
}

/** 検証失敗の分類。呼び出し元がHTTPステータスやエラーコードに変換する */
export const SlotValidationCodes = {
  INVALID_TIME: "invalid_time",
  INVALID_DURATION: "invalid_duration",
  TOO_SOON: "too_soon",
  CLOSED: "closed",
  OUTSIDE_BUSINESS_HOURS: "outside_business_hours",
  INVALID_SLOT: "invalid_slot",
  BREAK_TIME: "break_time",
} as const

const SCHEDULE_COLUMNS =
  "day_of_week, start_time, end_time, is_holiday_pattern, break_start_time, break_end_time"

/**
 * "HH:MM" / "HH:MM:SS" を深夜0時からの経過分に変換する
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

/**
 * 瞬間(ISO文字列)から、JSTでの暦日と「JST深夜0時からの経過分」を導出する。
 *
 * スロット生成は `${date}T${HH:MM}:00+09:00` を組み立てているため、検証側も
 * JST基準に揃える必要がある。サーバのタイムゾーン設定に依存させない。
 */
export function toJstParts(iso: string): { date: string; minutes: number } | null {
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return null

  const shifted = new Date(ms + JST_OFFSET_MS)
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  }
}

/**
 * weekly_schedules を1往復で読み込む。
 *
 * 週次スロットAPIが7日分をループするため、日ごとにクエリするとN+1になる。
 * 読み込みと選択を分けてある。
 */
export async function loadScheduleSet(): Promise<ScheduleSet> {
  const supabase = getSupabaseServiceRole()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: weekday, error: weekdayError } = await (supabase as any)
    .from("weekly_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("is_holiday_pattern", false) as {
      data: ActiveSchedule[] | null
      error: { message: string } | null
    }

  if (weekdayError) {
    console.error("[schedule] Failed to load weekday schedules:", weekdayError)
    throw new Error("営業時間の取得に失敗しました")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: holiday, error: holidayError } = await (supabase as any)
    .from("weekly_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("is_holiday_pattern", true)
    .limit(1)
    .maybeSingle() as {
      data: ActiveSchedule | null
      error: { message: string } | null
    }

  // 祝日パターン未設定は正常（祝日は休業扱いになる）
  if (holidayError) {
    console.warn("[schedule] Holiday schedule not found:", holidayError)
  }

  return {
    weekday: weekday ?? [],
    holiday: holidayError ? null : holiday,
  }
}

/**
 * 日付(JST)と祝日フラグから該当スケジュールを選ぶ。null は休業を意味する。
 *
 * weekly_schedules には (day_of_week, is_holiday_pattern) の一意制約が無く
 * 重複行を許すため、既存実装と同じく先頭1件を採用する。
 */
export function pickSchedule(
  set: ScheduleSet,
  dateJst: string,
  isHoliday: boolean
): ActiveSchedule | null {
  if (isHoliday) return set.holiday

  // dateJst は YYYY-MM-DD。JST正午を基準にして曜日のズレを避ける
  const dayOfWeek = new Date(`${dateJst}T12:00:00+09:00`).getUTCDay()
  return set.weekday.find((s) => s.day_of_week === dayOfWeek) ?? null
}

/**
 * 単日のスケジュールを解決する（読み込み + 祝日判定 + 選択）
 */
export async function resolveActiveSchedule(dateJst: string): Promise<ActiveSchedule | null> {
  const [set, isHoliday] = await Promise.all([
    loadScheduleSet(),
    isJapaneseHoliday(dateJst),
  ])
  return pickSchedule(set, dateJst, isHoliday)
}

/**
 * 予約枠が営業スケジュール上妥当かを検証する。
 *
 * slots/week/route.ts の生成ループと同じ条件を課すことで、UIが提示しない枠を
 * すべて拒否する。エラーは既存の validateGuestBooking と同様に蓄積して返す。
 */
export async function validateBookingSlot(input: {
  startTime: string
  endTime: string
  durationMinutes?: number
}): Promise<SlotValidationResult> {
  const durationMinutes = input.durationMinutes ?? DEFAULT_DURATION_MINUTES
  const errors: string[] = []

  const startMs = new Date(input.startTime).getTime()
  const endMs = new Date(input.endTime).getTime()

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return {
      valid: false,
      errors: ["予約日時の形式が正しくありません"],
      code: SlotValidationCodes.INVALID_TIME,
    }
  }

  // 秒・ミリ秒を含む開始時刻を拒否する。
  // toJstParts は分までしか見ないため 10:30:45 のような値は30分境界チェックを
  // すり抜け、グリッド外の予約がEXCLUDE制約で前後2スロットを塞いでしまう。
  if (startMs % 60_000 !== 0) {
    return {
      valid: false,
      errors: ["予約枠の開始時刻が正しくありません"],
      code: SlotValidationCodes.INVALID_SLOT,
    }
  }

  // 予約時間はメニューの規定どおりであること。
  // ここを緩めると end=start+30日 のような予約でEXCLUDE制約が
  // 以降の全予約を弾く（未認証DoS）。
  if (endMs - startMs !== durationMinutes * 60 * 1000) {
    return {
      valid: false,
      errors: [`予約時間は${durationMinutes}分で指定してください`],
      code: SlotValidationCodes.INVALID_DURATION,
    }
  }

  const minHoursAhead = await getBookingMinHoursAhead()
  const minBookingTime = new Date()
  minBookingTime.setHours(minBookingTime.getHours() + minHoursAhead)
  if (startMs <= minBookingTime.getTime()) {
    return {
      valid: false,
      errors: [`予約は${minHoursAhead}時間後以降の日時を選択してください`],
      code: SlotValidationCodes.TOO_SOON,
    }
  }

  const jst = toJstParts(input.startTime)
  if (!jst) {
    return {
      valid: false,
      errors: ["予約日時の形式が正しくありません"],
      code: SlotValidationCodes.INVALID_TIME,
    }
  }

  const schedule = await resolveActiveSchedule(jst.date)
  if (!schedule) {
    return {
      valid: false,
      errors: ["この日は予約を受け付けていません"],
      code: SlotValidationCodes.CLOSED,
    }
  }

  const scheduleStart = timeToMinutes(schedule.start_time)
  const scheduleEnd = timeToMinutes(schedule.end_time)
  const slotStart = jst.minutes
  const slotEnd = slotStart + durationMinutes

  if (slotStart < scheduleStart || slotEnd > scheduleEnd) {
    errors.push("営業時間外の時間帯です")
    return { valid: false, errors, code: SlotValidationCodes.OUTSIDE_BUSINESS_HOURS }
  }

  // 営業開始時刻を起点とした30分刻みに乗っていること
  if ((slotStart - scheduleStart) % SLOT_INTERVAL_MINUTES !== 0) {
    errors.push("予約枠の開始時刻が正しくありません")
    return { valid: false, errors, code: SlotValidationCodes.INVALID_SLOT }
  }

  if (schedule.break_start_time && schedule.break_end_time) {
    const breakStart = timeToMinutes(schedule.break_start_time)
    const breakEnd = timeToMinutes(schedule.break_end_time)
    if (slotStart < breakEnd && slotEnd > breakStart) {
      errors.push("休憩時間中は予約できません")
      return { valid: false, errors, code: SlotValidationCodes.BREAK_TIME }
    }
  }

  return { valid: true, errors: [] }
}
