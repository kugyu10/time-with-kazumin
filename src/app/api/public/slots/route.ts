/**
 * GET /api/public/slots
 *
 * 空きスロット取得API（認証不要）
 * 指定日の空きスロット一覧を返す
 * Google Calendarのbusy時間も考慮して空き判定
 */

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { getCachedBusyTimes, BusyTime } from "@/lib/integrations/google-calendar"
import { getBookingMinHoursAhead, getBufferBeforeMinutes, getBufferAfterMinutes } from "@/lib/settings/app-settings"
import { isJapaneseHoliday } from "@/lib/utils/holidays"

// 遅延初期化用のクライアント取得関数
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables")
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

interface Slot {
  date: string
  startTime: string
  endTime: string
  available: boolean
}

/**
 * busy時間との重複チェック（バッファ適用）
 * busyTimeの前後にバッファを適用して、スロットと重複するかチェック
 */
function isSlotBusy(
  slotStart: Date,
  slotEnd: Date,
  busyTimes: BusyTime[],
  bufferBeforeMs: number = 0,
  bufferAfterMs: number = 0
): boolean {
  return busyTimes.some((busy) => {
    // バッファを適用したbusy時間の範囲を計算
    // busy.startの前にbufferBeforeを適用 = busy.start - bufferBefore
    // busy.endの後にbufferAfterを適用 = busy.end + bufferAfter
    const busyStartWithBuffer = new Date(busy.start).getTime() - bufferBeforeMs
    const busyEndWithBuffer = new Date(busy.end).getTime() + bufferAfterMs
    const slotStartTime = slotStart.getTime()
    const slotEndTime = slotEnd.getTime()
    // 重複判定: slotStart < busyEndWithBuffer && slotEnd > busyStartWithBuffer
    return slotStartTime < busyEndWithBuffer && slotEndTime > busyStartWithBuffer
  })
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabase()
    const url = new URL(request.url)
    const date = url.searchParams.get("date")

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "date パラメータが必要です (YYYY-MM-DD 形式)" },
        { status: 400 }
      )
    }

    // 日付から曜日を取得
    const targetDate = new Date(date)
    const dayOfWeek = targetDate.getDay()

    // 祝日判定
    const isHoliday = await isJapaneseHoliday(date)

    // スケジュール取得：祝日の場合は曜日を無視
    let activeSchedule: {
      day_of_week: number
      start_time: string
      end_time: string
      is_holiday_pattern: boolean
      break_start_time: string | null
      break_end_time: string | null
    } | null = null

    if (isHoliday) {
      // 祝日: is_holiday_pattern=true の最初の1行を使用（曜日無視）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: holidaySchedule, error: scheduleError } = await (supabase as any)
        .from("weekly_schedules")
        .select("day_of_week, start_time, end_time, is_holiday_pattern, break_start_time, break_end_time")
        .eq("is_holiday_pattern", true)
        .limit(1)
        .single() as {
          data: {
            day_of_week: number
            start_time: string
            end_time: string
            is_holiday_pattern: boolean
            break_start_time: string | null
            break_end_time: string | null
          } | null
          error: { message: string } | null
        }

      if (scheduleError) {
        // 祝日パターンが見つからない場合はスルー（activeSchedule = null）
        console.warn("[GET /api/public/slots] Holiday schedule not found:", scheduleError)
      } else {
        activeSchedule = holidaySchedule
      }
    } else {
      // 平日: 該当曜日のis_holiday_pattern=falseを使用
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: weekdaySchedule, error: scheduleError } = await (supabase as any)
        .from("weekly_schedules")
        .select("day_of_week, start_time, end_time, is_holiday_pattern, break_start_time, break_end_time")
        .eq("day_of_week", dayOfWeek)
        .eq("is_holiday_pattern", false)
        .limit(1)
        .single() as {
          data: {
            day_of_week: number
            start_time: string
            end_time: string
            is_holiday_pattern: boolean
            break_start_time: string | null
            break_end_time: string | null
          } | null
          error: { message: string } | null
        }

      if (scheduleError) {
        console.warn("[GET /api/public/slots] Weekday schedule not found:", scheduleError)
      } else {
        activeSchedule = weekdaySchedule
      }
    }

    // スケジュールがない場合は空配列を返す
    if (!activeSchedule) {
      return NextResponse.json({ slots: [] })
    }

    // 該当日の予約を取得（キャンセル以外）
    const dayStart = `${date}T00:00:00`
    const dayEnd = `${date}T23:59:59`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookings, error: bookingsError } = await (supabase as any)
      .from("bookings")
      .select("start_time, end_time, status")
      .neq("status", "canceled")
      .gte("start_time", dayStart)
      .lte("end_time", dayEnd) as {
        data: Array<{ start_time: string; end_time: string; status: string }> | null
        error: { message: string } | null
      }

    if (bookingsError) {
      console.error("[GET /api/public/slots] Bookings error:", bookingsError)
      return NextResponse.json(
        { error: "予約情報取得に失敗しました" },
        { status: 500 }
      )
    }

    const existingBookings = bookings || []

    // Google Calendarのbusy時間を取得（15分キャッシュ）
    // ISO形式でタイムゾーン付きの日時を指定
    const busyTimeStart = `${date}T00:00:00+09:00`
    const busyTimeEnd = `${date}T23:59:59+09:00`
    let busyTimes: BusyTime[] = []

    try {
      busyTimes = await getCachedBusyTimes(busyTimeStart, busyTimeEnd)
      console.log(
        `[GET /api/public/slots] Got ${busyTimes.length} busy times from calendar`
      )
    } catch (error) {
      // busy時間取得失敗時はログのみ、予約は可能にする
      console.warn(
        "[GET /api/public/slots] Failed to get busy times, continuing without calendar check:",
        error
      )
    }

    // 30分単位でスロット生成
    const slots: Slot[] = []
    const durationMinutes = 30 // 発光ポジティブちょい浴び30分固定

    // DB設定から予約可能時間とバッファを取得
    const bookingMinHoursAhead = await getBookingMinHoursAhead()
    const bufferBeforeMinutes = await getBufferBeforeMinutes()
    const bufferAfterMinutes = await getBufferAfterMinutes()

    // バッファをミリ秒に変換
    const bufferBeforeMs = bufferBeforeMinutes * 60 * 1000
    const bufferAfterMs = bufferAfterMinutes * 60 * 1000

    const [startHour, startMin] = activeSchedule.start_time.split(":").map(Number)
    const [endHour, endMin] = activeSchedule.end_time.split(":").map(Number)

    const scheduleStart = startHour * 60 + startMin
    const scheduleEnd = endHour * 60 + endMin

    // 休憩時間の解析
    let breakStart: number | null = null
    let breakEnd: number | null = null
    if (activeSchedule.break_start_time && activeSchedule.break_end_time) {
      const [breakStartHour, breakStartMin] = activeSchedule.break_start_time.split(":").map(Number)
      const [breakEndHour, breakEndMin] = activeSchedule.break_end_time.split(":").map(Number)
      breakStart = breakStartHour * 60 + breakStartMin
      breakEnd = breakEndHour * 60 + breakEndMin
    }

    // 30分間隔でスロット生成
    for (let time = scheduleStart; time + durationMinutes <= scheduleEnd; time += 30) {
      // 休憩時間と重なるスロットはスキップ
      if (breakStart !== null && breakEnd !== null) {
        const slotEnd = time + durationMinutes
        // スロットが休憩時間と重なっているかチェック
        if (time < breakEnd && slotEnd > breakStart) {
          continue
        }
      }

      const slotStartHour = Math.floor(time / 60)
      const slotStartMin = time % 60
      const slotEndTime = time + durationMinutes
      const slotEndHour = Math.floor(slotEndTime / 60)
      const slotEndMin = slotEndTime % 60

      const startTimeStr = `${String(slotStartHour).padStart(2, "0")}:${String(slotStartMin).padStart(2, "0")}`
      const endTimeStr = `${String(slotEndHour).padStart(2, "0")}:${String(slotEndMin).padStart(2, "0")}`

      const slotStartISO = `${date}T${startTimeStr}:00+09:00`
      const slotEndISO = `${date}T${endTimeStr}:00+09:00`

      // 既存予約との重複チェック（バッファ適用）
      // 予約の前にbufferBeforeを、後にbufferAfterを適用して除外判定
      const isBooked = existingBookings.some((booking) => {
        const bookingStartWithBuffer = new Date(booking.start_time).getTime() - bufferBeforeMs
        const bookingEndWithBuffer = new Date(booking.end_time).getTime() + bufferAfterMs
        const slotStart = new Date(slotStartISO).getTime()
        const slotEnd = new Date(slotEndISO).getTime()
        return slotStart < bookingEndWithBuffer && slotEnd > bookingStartWithBuffer
      })

      // Google Calendarのbusy時間との重複チェック（バッファ適用）
      const slotStartDate = new Date(slotStartISO)
      const slotEndDate = new Date(slotEndISO)
      const isBusy = isSlotBusy(slotStartDate, slotEndDate, busyTimes, bufferBeforeMs, bufferAfterMs)

      // 予約可能時間チェック（bookingMinHoursAhead時間後以降でなければ予約不可）
      const minBookingTime = new Date()
      minBookingTime.setHours(minBookingTime.getHours() + bookingMinHoursAhead)
      const isTooSoon = slotStartDate <= minBookingTime

      slots.push({
        date,
        startTime: slotStartISO,
        endTime: slotEndISO,
        available: !isBooked && !isBusy && !isTooSoon,
      })
    }

    return NextResponse.json({ slots })
  } catch (error) {
    console.error("[GET /api/public/slots] Error:", error)
    return NextResponse.json(
      { error: "スロット取得に失敗しました" },
      { status: 500 }
    )
  }
}
