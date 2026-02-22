/**
 * GET /api/public/slots
 *
 * 空きスロット取得API（認証不要）
 * 指定日の空きスロット一覧を返す
 */

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

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

    // 該当曜日のスケジュールを取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: schedules, error: scheduleError } = await (supabase as any)
      .from("weekly_schedules")
      .select("day_of_week, start_time, end_time")
      .eq("day_of_week", dayOfWeek) as {
        data: Array<{ day_of_week: number; start_time: string; end_time: string }> | null
        error: { message: string } | null
      }

    if (scheduleError) {
      console.error("[GET /api/public/slots] Schedule error:", scheduleError)
      return NextResponse.json(
        { error: "スケジュール取得に失敗しました" },
        { status: 500 }
      )
    }

    // スケジュールがない場合は空配列を返す
    if (!schedules || schedules.length === 0) {
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

    // 30分単位でスロット生成
    const slots: Slot[] = []
    const durationMinutes = 30 // カジュアル30分セッション固定

    for (const schedule of schedules) {
      const [startHour, startMin] = schedule.start_time.split(":").map(Number)
      const [endHour, endMin] = schedule.end_time.split(":").map(Number)

      const scheduleStart = startHour * 60 + startMin
      const scheduleEnd = endHour * 60 + endMin

      // 30分間隔でスロット生成
      for (let time = scheduleStart; time + durationMinutes <= scheduleEnd; time += 30) {
        const slotStartHour = Math.floor(time / 60)
        const slotStartMin = time % 60
        const slotEndTime = time + durationMinutes
        const slotEndHour = Math.floor(slotEndTime / 60)
        const slotEndMin = slotEndTime % 60

        const startTimeStr = `${String(slotStartHour).padStart(2, "0")}:${String(slotStartMin).padStart(2, "0")}`
        const endTimeStr = `${String(slotEndHour).padStart(2, "0")}:${String(slotEndMin).padStart(2, "0")}`

        const slotStartISO = `${date}T${startTimeStr}:00`
        const slotEndISO = `${date}T${endTimeStr}:00`

        // 既存予約との重複チェック
        const isBooked = existingBookings.some((booking) => {
          const bookingStart = new Date(booking.start_time).getTime()
          const bookingEnd = new Date(booking.end_time).getTime()
          const slotStart = new Date(slotStartISO).getTime()
          const slotEnd = new Date(slotEndISO).getTime()
          return slotStart < bookingEnd && slotEnd > bookingStart
        })

        // 過去日時チェック
        const slotDateTime = new Date(slotStartISO)
        const isPast = slotDateTime <= new Date()

        slots.push({
          date,
          startTime: slotStartISO,
          endTime: slotEndISO,
          available: !isBooked && !isPast,
        })
      }
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
