/**
 * GET /api/public/slots/week
 *
 * 週間スロット取得API（認証不要）
 * 指定された開始日から7日間の空きスロット一覧を返す
 */

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { getCachedBusyTimes, BusyTime } from "@/lib/integrations/google-calendar"
import { getBookingMinHoursAhead } from "@/lib/settings/app-settings"
import { isJapaneseHoliday } from "@/lib/utils/holidays"

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

function isSlotBusy(
  slotStart: Date,
  slotEnd: Date,
  busyTimes: BusyTime[]
): boolean {
  return busyTimes.some((busy) => {
    const busyStart = new Date(busy.start).getTime()
    const busyEnd = new Date(busy.end).getTime()
    const slotStartTime = slotStart.getTime()
    const slotEndTime = slotEnd.getTime()
    return slotStartTime < busyEnd && slotEndTime > busyStart
  })
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabase()
    const url = new URL(request.url)
    const startDate = url.searchParams.get("start")

    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return NextResponse.json(
        { error: "start パラメータが必要です (YYYY-MM-DD 形式)" },
        { status: 400 }
      )
    }

    // オプションパラメータ
    const durationParam = url.searchParams.get("duration")
    const durationMinutes = durationParam ? parseInt(durationParam, 10) : 30
    const minHoursParam = url.searchParams.get("minHours")
    const customMinHoursAhead = minHoursParam ? parseInt(minHoursParam, 10) : null

    // 7日間の日付を生成
    const dates: string[] = []
    const baseDate = new Date(startDate)
    for (let i = 0; i < 7; i++) {
      const date = new Date(baseDate)
      date.setDate(baseDate.getDate() + i)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      dates.push(`${year}-${month}-${day}`)
    }

    // 全曜日のスケジュールを取得（平日・祝日両パターン）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: schedules, error: scheduleError } = await (supabase as any)
      .from("weekly_schedules")
      .select("day_of_week, start_time, end_time, is_holiday_pattern, break_start_time, break_end_time") as {
        data: Array<{
          day_of_week: number
          start_time: string
          end_time: string
          is_holiday_pattern: boolean
          break_start_time: string | null
          break_end_time: string | null
        }> | null
        error: { message: string } | null
      }

    if (scheduleError) {
      console.error("[GET /api/public/slots/week] Schedule error:", scheduleError)
      return NextResponse.json(
        { error: "スケジュール取得に失敗しました" },
        { status: 500 }
      )
    }

    // 週間の予約を取得
    const weekStart = `${dates[0]}T00:00:00`
    const weekEnd = `${dates[6]}T23:59:59`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookings, error: bookingsError } = await (supabase as any)
      .from("bookings")
      .select("start_time, end_time, status")
      .neq("status", "canceled")
      .gte("start_time", weekStart)
      .lte("end_time", weekEnd) as {
        data: Array<{ start_time: string; end_time: string; status: string }> | null
        error: { message: string } | null
      }

    if (bookingsError) {
      console.error("[GET /api/public/slots/week] Bookings error:", bookingsError)
      return NextResponse.json(
        { error: "予約情報取得に失敗しました" },
        { status: 500 }
      )
    }

    const existingBookings = bookings || []

    // Google Calendarのbusy時間を取得（週間分）
    const busyTimeStart = `${dates[0]}T00:00:00+09:00`
    const busyTimeEnd = `${dates[6]}T23:59:59+09:00`
    let busyTimes: BusyTime[] = []

    try {
      busyTimes = await getCachedBusyTimes(busyTimeStart, busyTimeEnd)
    } catch (error) {
      console.warn("[GET /api/public/slots/week] Failed to get busy times:", error)
    }

    // 設定取得（パラメータ指定がなければDB設定を使用）
    const bookingMinHoursAhead = customMinHoursAhead ?? await getBookingMinHoursAhead()

    // 各日のスロットを生成
    const result: Record<string, Slot[]> = {}

    for (const date of dates) {
      const targetDate = new Date(date)
      const dayOfWeek = targetDate.getDay()

      // 祝日判定
      const isHoliday = await isJapaneseHoliday(date)

      // 適切なパターンのスケジュールを取得（祝日なら祝日パターン、そうでなければ平日パターン）
      const schedule = schedules?.find(
        (s) => s.day_of_week === dayOfWeek && s.is_holiday_pattern === isHoliday
      )

      // 該当パターンがなければ反対のパターンを試す
      const fallbackSchedule =
        schedule ??
        schedules?.find(
          (s) => s.day_of_week === dayOfWeek && s.is_holiday_pattern !== isHoliday
        )

      if (!fallbackSchedule) {
        result[date] = []
        continue
      }

      const activeSchedule = schedule ?? fallbackSchedule

      const slots: Slot[] = []
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

        const isBooked = existingBookings.some((booking) => {
          const bookingStart = new Date(booking.start_time).getTime()
          const bookingEnd = new Date(booking.end_time).getTime()
          const slotStart = new Date(slotStartISO).getTime()
          const slotEnd = new Date(slotEndISO).getTime()
          return slotStart < bookingEnd && slotEnd > bookingStart
        })

        const slotStartDate = new Date(slotStartISO)
        const slotEndDate = new Date(slotEndISO)
        const isBusy = isSlotBusy(slotStartDate, slotEndDate, busyTimes)

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

      result[date] = slots
    }

    return NextResponse.json({ slots: result })
  } catch (error) {
    console.error("[GET /api/public/slots/week] Error:", error)
    return NextResponse.json(
      { error: "スロット取得に失敗しました" },
      { status: 500 }
    )
  }
}
