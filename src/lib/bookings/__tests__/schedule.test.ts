/**
 * 営業スケジュール解決と予約枠検証のユニットテスト
 *
 * テスト対象:
 * - pickSchedule: 祝日/平日パターンの選択（純粋関数）
 * - toJstParts: JST基準の暦日と経過分の導出（日境界）
 * - validateBookingSlot: 休業日・営業時間外・休憩時間・スロット境界・
 *   予約時間の不一致・最短予約時間
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// --- モックはSUTのimportより前に置く（vi.mockのホイスティング前提） ---

const scheduleRows: { weekday: unknown[]; holiday: unknown } = {
  weekday: [],
  holiday: null,
}

vi.mock("@/lib/supabase/service-role", () => ({
  getSupabaseServiceRole: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        // .eq("is_holiday_pattern", false) → 平日一覧をそのまま解決
        // .eq("is_holiday_pattern", true).limit(1).maybeSingle() → 祝日1件
        eq: (_col: string, value: boolean) => {
          if (value === false) {
            return Promise.resolve({ data: scheduleRows.weekday, error: null })
          }
          return {
            limit: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: scheduleRows.holiday, error: null }),
            }),
          }
        },
      }),
    }),
  })),
}))

const isJapaneseHolidayMock = vi.fn().mockResolvedValue(false)
vi.mock("@/lib/utils/holidays", () => ({
  isJapaneseHoliday: (date: string) => isJapaneseHolidayMock(date),
}))

vi.mock("@/lib/settings/app-settings", () => ({
  getBookingMinHoursAhead: vi.fn().mockResolvedValue(24),
}))

import {
  validateBookingSlot,
  pickSchedule,
  toJstParts,
  timeToMinutes,
  SlotValidationCodes,
  type ActiveSchedule,
} from "../schedule"

// --- フィクスチャ ---

function schedule(overrides: Partial<ActiveSchedule> = {}): ActiveSchedule {
  return {
    day_of_week: 1,
    start_time: "10:00:00",
    end_time: "17:00:00",
    is_holiday_pattern: false,
    break_start_time: null,
    break_end_time: null,
    ...overrides,
  }
}

/** 「N日後のJSTのHH:MM」をISO文字列で返す。最短予約時間(24h)を確実に満たす */
function jstAt(daysAhead: number, hhmm: string): string {
  const base = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
  const jstDate = new Date(base.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  return new Date(`${jstDate}T${hhmm}:00+09:00`).toISOString()
}

/** startから指定分後 */
function plusMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000).toISOString()
}

/** 対象日の曜日にあわせた平日スケジュールを登録する */
function setWeekdaySchedule(startIso: string, overrides: Partial<ActiveSchedule> = {}) {
  const jst = toJstParts(startIso)!
  const dow = new Date(`${jst.date}T12:00:00+09:00`).getUTCDay()
  scheduleRows.weekday = [schedule({ day_of_week: dow, ...overrides })]
}

beforeEach(() => {
  vi.clearAllMocks()
  isJapaneseHolidayMock.mockResolvedValue(false)
  scheduleRows.weekday = []
  scheduleRows.holiday = null
})

describe("timeToMinutes()", () => {
  it("HH:MM:SS と HH:MM の両方を分に変換する", () => {
    expect(timeToMinutes("10:00:00")).toBe(600)
    expect(timeToMinutes("17:30")).toBe(1050)
    expect(timeToMinutes("00:00:00")).toBe(0)
  })
})

describe("toJstParts()", () => {
  it("JSTの暦日と深夜0時からの経過分を返す", () => {
    // 2026-09-01T10:30+09:00 = 2026-09-01T01:30Z
    const r = toJstParts("2026-09-01T01:30:00.000Z")!
    expect(r.date).toBe("2026-09-01")
    expect(r.minutes).toBe(10 * 60 + 30)
  })

  it("JST日境界: 00:30+09:00 はUTCでは前日だがJSTの日付で解決される", () => {
    // 2026-09-01T00:30+09:00 = 2026-08-31T15:30Z
    const r = toJstParts("2026-08-31T15:30:00.000Z")!
    expect(r.date).toBe("2026-09-01")
    expect(r.minutes).toBe(30)
  })

  it("不正な日時では null を返す", () => {
    expect(toJstParts("not-a-date")).toBeNull()
  })
})

describe("pickSchedule()", () => {
  it("祝日なら曜日を無視して祝日パターンを返す", () => {
    const holiday = schedule({ is_holiday_pattern: true, start_time: "13:00:00" })
    const set = { weekday: [schedule({ day_of_week: 3 })], holiday }
    // 2026-09-02 は水曜だが、祝日フラグが立てば祝日パターン
    expect(pickSchedule(set, "2026-09-02", true)).toBe(holiday)
  })

  it("祝日で祝日パターン未設定なら null（休業）", () => {
    const set = { weekday: [schedule({ day_of_week: 3 })], holiday: null }
    expect(pickSchedule(set, "2026-09-02", true)).toBeNull()
  })

  it("平日は該当曜日の行を返す", () => {
    // 2026-09-02 は水曜 = 3
    const wed = schedule({ day_of_week: 3 })
    const set = { weekday: [schedule({ day_of_week: 1 }), wed], holiday: null }
    expect(pickSchedule(set, "2026-09-02", false)).toBe(wed)
  })

  it("該当曜日の行が無ければ null（休業日）", () => {
    const set = { weekday: [schedule({ day_of_week: 1 })], holiday: null }
    expect(pickSchedule(set, "2026-09-02", false)).toBeNull()
  })
})

describe("validateBookingSlot()", () => {
  it("Test 1: 営業時間内・スロット境界一致なら valid", async () => {
    const start = jstAt(3, "10:30")
    setWeekdaySchedule(start)

    const result = await validateBookingSlot({
      startTime: start,
      endTime: plusMinutes(start, 30),
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it("Test 2: 該当曜日のスケジュールが無ければ休業日として拒否", async () => {
    const start = jstAt(3, "10:30")
    scheduleRows.weekday = [] // 行なし

    const result = await validateBookingSlot({
      startTime: start,
      endTime: plusMinutes(start, 30),
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe(SlotValidationCodes.CLOSED)
  })

  it("Test 3: 営業開始前は拒否", async () => {
    const start = jstAt(3, "09:30")
    setWeekdaySchedule(start) // 10:00-17:00

    const result = await validateBookingSlot({
      startTime: start,
      endTime: plusMinutes(start, 30),
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe(SlotValidationCodes.OUTSIDE_BUSINESS_HOURS)
  })

  it("Test 4: 終了時刻が営業終了を超える枠は拒否", async () => {
    const start = jstAt(3, "16:45")
    setWeekdaySchedule(start, { start_time: "10:15:00", end_time: "17:00:00" })

    // 16:45+30分 = 17:15 で営業終了を超える（境界自体は一致している）
    const result = await validateBookingSlot({
      startTime: start,
      endTime: plusMinutes(start, 30),
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe(SlotValidationCodes.OUTSIDE_BUSINESS_HOURS)
  })

  it("Test 5: スロット境界に乗らない開始時刻は拒否", async () => {
    const start = jstAt(3, "10:07")
    setWeekdaySchedule(start) // 10:00起点の30分刻み

    const result = await validateBookingSlot({
      startTime: start,
      endTime: plusMinutes(start, 30),
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe(SlotValidationCodes.INVALID_SLOT)
  })

  it("Test 6: 休憩時間と重なる枠は拒否", async () => {
    const start = jstAt(3, "12:00")
    setWeekdaySchedule(start, {
      break_start_time: "12:00:00",
      break_end_time: "13:00:00",
    })

    const result = await validateBookingSlot({
      startTime: start,
      endTime: plusMinutes(start, 30),
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe(SlotValidationCodes.BREAK_TIME)
  })

  it("Test 6-1: 休憩時間の直後は予約できる", async () => {
    const start = jstAt(3, "13:00")
    setWeekdaySchedule(start, {
      break_start_time: "12:00:00",
      break_end_time: "13:00:00",
    })

    const result = await validateBookingSlot({
      startTime: start,
      endTime: plusMinutes(start, 30),
    })

    expect(result.valid).toBe(true)
  })

  it("Test 7: 予約時間がメニュー既定と異なる場合は拒否（長大予約によるDoS防止）", async () => {
    const start = jstAt(3, "10:30")
    setWeekdaySchedule(start)

    // end = start + 30日
    const result = await validateBookingSlot({
      startTime: start,
      endTime: plusMinutes(start, 30 * 24 * 60),
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe(SlotValidationCodes.INVALID_DURATION)
  })

  it("Test 8: 最短予約時間内は拒否", async () => {
    // 1時間後（既定は24時間後以降）。秒・ミリ秒を落として分境界に揃える
    // （揃えないと秒を持つ開始時刻として INVALID_SLOT で先に弾かれる）
    const start = new Date(
      Math.floor((Date.now() + 60 * 60 * 1000) / 60_000) * 60_000
    ).toISOString()
    setWeekdaySchedule(start)

    const result = await validateBookingSlot({
      startTime: start,
      endTime: plusMinutes(start, 30),
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe(SlotValidationCodes.TOO_SOON)
  })

  it("Test 8.5: 秒を含む開始時刻は拒否（30分境界の回避を防ぐ）", async () => {
    // 10:30:45 は分だけ見ると10:30と同じで境界チェックを通過してしまう。
    // 通すと 10:30:45-11:00:45 の予約が10:30と11:00の両枠をEXCLUDE制約で塞ぐ。
    const start = jstAt(3, "10:30").replace(":00.000Z", ":45.000Z")
    setWeekdaySchedule(start)

    const result = await validateBookingSlot({
      startTime: start,
      endTime: plusMinutes(start, 30),
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe(SlotValidationCodes.INVALID_SLOT)
  })

  it("Test 9: 祝日は曜日ではなく祝日パターンで判定される", async () => {
    const start = jstAt(3, "14:00")
    isJapaneseHolidayMock.mockResolvedValue(true)
    scheduleRows.weekday = [] // 平日パターンは空でも
    scheduleRows.holiday = schedule({
      is_holiday_pattern: true,
      start_time: "14:00:00",
      end_time: "16:00:00",
    })

    const result = await validateBookingSlot({
      startTime: start,
      endTime: plusMinutes(start, 30),
    })

    expect(result.valid).toBe(true)
  })

  it("Test 10: メニュー既定の予約時間（60分）を尊重する", async () => {
    const start = jstAt(3, "10:30")
    setWeekdaySchedule(start)

    const result = await validateBookingSlot({
      startTime: start,
      endTime: plusMinutes(start, 60),
      durationMinutes: 60,
    })

    expect(result.valid).toBe(true)
  })

  it("Test 11: 不正な日時形式は拒否", async () => {
    const result = await validateBookingSlot({
      startTime: "not-a-date",
      endTime: "also-not-a-date",
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe(SlotValidationCodes.INVALID_TIME)
  })
})
