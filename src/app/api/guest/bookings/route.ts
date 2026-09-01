/**
 * POST /api/guest/bookings
 *
 * ゲスト予約作成API
 * 認証なしで発光ポジティブちょい浴び30分を予約
 * Zoom会議作成、Googleカレンダー登録、確認メール送信を実行
 */

import { NextResponse } from "next/server"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"
import { checkGuestRateLimit } from "@/lib/rate-limit/guest-limiter"
import { validateGuestBooking } from "@/lib/validation/guest"
import { validateBookingSlot } from "@/lib/bookings/schedule"
import { checkBookingConflict } from "@/lib/bookings/conflicts"
import { generateCancelToken } from "@/lib/tokens/cancel-token"
import { randomUUID } from "crypto"
import { createZoomMeeting, deleteZoomMeeting } from "@/lib/integrations/zoom"
import {
  addCalendarEvent,
  deleteCalendarEvent,
  buildCalendarEventId,
} from "@/lib/integrations/google-calendar"
import { sendBookingConfirmationEmail } from "@/lib/integrations/email"

// 発光ポジティブちょい浴び30分のメニューID（固定）
const CASUAL_30_MENU_ID = 1
const CASUAL_30_DURATION = 30
const CASUAL_30_NAME = "発光ポジティブちょい浴び30分"

// Base URL for cancel links
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

/**
 * Generate Google Calendar add URL
 */
function generateGoogleCalendarUrl(
  title: string,
  startTime: string,
  endTime: string,
  description?: string
): string {
  const start = new Date(startTime).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const end = new Date(endTime).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    ctz: "Asia/Tokyo",
  })

  if (description) {
    params.set("details", description)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export async function POST(request: Request) {
  // Track created resources for cleanup on failure
  let zoomMeetingId: string | null = null
  let zoomJoinUrl: string | null = null
  let googleEventId: string | null = null
  let bookingId: number | null = null

  try {
    // IPアドレスの取得
    const forwardedFor = request.headers.get("x-forwarded-for")
    const ip = forwardedFor?.split(",")[0]?.trim() || "127.0.0.1"

    // リクエストボディの解析
    const body = await request.json()
    const { email, name, slotDate, startTime, endTime: requestedEndTime } = body as {
      email?: string
      name?: string
      slotDate?: string
      startTime?: string
      endTime?: string
    }

    // 基本的な必須フィールドチェック
    if (!email || !name || !slotDate || !startTime || !requestedEndTime) {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 }
      )
    }

    // レート制限チェック
    const rateLimit = checkGuestRateLimit(ip, email)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "予約リクエストの上限に達しました。しばらく時間をおいてお試しください。" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(rateLimit.resetAt),
          },
        }
      )
    }

    // バリデーション
    const validation = await validateGuestBooking({
      email,
      name,
      slotDate,
      startTime,
      endTime: requestedEndTime,
    })
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(", ") },
        { status: 400 }
      )
    }

    // 予約の終了時刻はクライアント値を信用せずサーバ側で確定させる。
    // endTime をそのまま通すと start + 30日 のような長大予約を未認証で作成でき、
    // no_overlapping_bookings EXCLUDE 制約が以降の全予約を弾くDoSになる。
    // validator.isISO8601 は非strictで "2026-W01-1" のように Date がパースできない
    // 形式も通すため、NaN のまま toISOString() すると RangeError → 500 になる。
    const startMs = new Date(startTime).getTime()
    if (Number.isNaN(startMs)) {
      return NextResponse.json(
        { error: "予約日時の形式が正しくありません" },
        { status: 400 }
      )
    }
    const endTime = new Date(
      startMs + CASUAL_30_DURATION * 60 * 1000
    ).toISOString()

    if (new Date(requestedEndTime).getTime() !== new Date(endTime).getTime()) {
      console.warn(
        `[Guest Booking] endTime mismatch, clamped to ${CASUAL_30_DURATION}min:`,
        { requested: requestedEndTime, applied: endTime }
      )
    }

    // 営業スケジュール上の妥当性を検証する。
    // validateGuestBooking はフィールド単位の検証しか行わず、休業日・営業時間外・
    // 休憩時間中・スロット境界外の予約がすべて通ってしまうため、ここで弾く。
    const slotCheck = await validateBookingSlot({
      startTime,
      endTime,
      durationMinutes: CASUAL_30_DURATION,
    })
    if (!slotCheck.valid) {
      console.warn("[Guest Booking] Slot validation failed:", {
        startTime,
        code: slotCheck.code,
      })
      return NextResponse.json(
        { error: slotCheck.errors.join(", ") },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServiceRole()
    const normalizedEmail = email.toLowerCase().trim()
    const trimmedName = name.trim()

    // Step 0: DB上の予約重複を事前チェック（バッファ適用）
    // Zoom/カレンダーなど外部リソースを作る前に弾く。
    // EXCLUDE制約はバッファを知らないため、バッファ分の重なりはここでしか止まらない。
    const conflictCheck = await checkBookingConflict(startTime, endTime)

    if (conflictCheck.status === "error") {
      return NextResponse.json(
        { error: "予約状況の確認に失敗しました" },
        { status: 500 }
      )
    }

    if (conflictCheck.status === "conflict") {
      return NextResponse.json(
        { error: "この時間帯は既に予約されています" },
        { status: 409 }
      )
    }

    // Step 1: Create Zoom meeting
    console.log("[Guest Booking] Step 1: Creating Zoom meeting")
    try {
      const zoomResult = await createZoomMeeting({
        topic: `${CASUAL_30_NAME} - ${trimmedName}`,
        start_time: startTime,
        duration: CASUAL_30_DURATION,
        accountType: "B", // ゲストは無料アカウント（40分制限）
      })
      zoomMeetingId = zoomResult.zoom_meeting_id
      zoomJoinUrl = zoomResult.zoom_join_url
      console.log("[Guest Booking] Zoom meeting created:", zoomMeetingId, zoomJoinUrl)
    } catch (error) {
      console.error("[Guest Booking] Zoom creation failed:", error)
      return NextResponse.json(
        { error: "Zoom会議の作成に失敗しました" },
        { status: 500 }
      )
    }

    // Step 2: Add Google Calendar event (non-blocking)
    // カレンダー連携（OAuthトークン失効等）の障害で予約自体を失敗させない
    console.log("[Guest Booking] Step 2: Adding calendar event")
    try {
      // リクエスト単位の決定論的イベントIDでinsertを冪等にする。
      // addCalendarEvent内部のリトライがレスポンスタイムアウト後に再送しても
      // 重複イベントは作られず、409時は既存IDが返るため孤児イベントにならない。
      const calendarResult = await addCalendarEvent({
        eventId: buildCalendarEventId(`guest${randomUUID().replace(/-/g, "")}`),
        summary: `${CASUAL_30_NAME} - ${trimmedName}`,
        start: startTime,
        end: endTime,
        description: zoomJoinUrl
          ? `Zoom: ${zoomJoinUrl}\n\nゲスト予約: ${trimmedName} (${normalizedEmail})`
          : `ゲスト予約: ${trimmedName} (${normalizedEmail})`,
      })
      googleEventId = calendarResult.google_event_id
      console.log("[Guest Booking] Calendar event created:", googleEventId)
    } catch (error) {
      console.error(
        "[Guest Booking] CALENDAR_SYNC_FAILED (non-blocking, booking continues). " +
          "OAuthトークン失効の可能性あり:",
        error
      )
      googleEventId = null
    }

    // Step 3: Create booking record
    console.log("[Guest Booking] Step 3: Creating booking record")
    const guestToken = randomUUID()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("bookings")
      .insert({
        menu_id: CASUAL_30_MENU_ID,
        guest_email: normalizedEmail,
        guest_name: trimmedName,
        guest_token: guestToken,
        start_time: startTime,
        end_time: endTime,
        status: "confirmed",
        member_plan_id: null,
        zoom_meeting_id: zoomMeetingId,
        zoom_join_url: zoomJoinUrl,
        google_event_id: googleEventId,
      })
      .select("id")
      .single() as { data: { id: number } | null; error: { code: string; message: string } | null }

    if (error) {
      console.error("[Guest Booking] Insert error:", error)

      // Cleanup Zoom and Calendar
      if (zoomMeetingId && !zoomMeetingId.startsWith("mock-")) {
        await deleteZoomMeeting(zoomMeetingId, "B").catch(console.error)
      }
      if (googleEventId && !googleEventId.startsWith("mock-")) {
        await deleteCalendarEvent(googleEventId).catch(console.error)
      }

      // EXCLUDE制約エラー（23P01）は既に予約済み
      if (error.code === "23P01") {
        return NextResponse.json(
          { error: "この時間帯は既に予約されています" },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: "予約の作成に失敗しました" },
        { status: 500 }
      )
    }

    if (!data) {
      // Cleanup
      if (zoomMeetingId && !zoomMeetingId.startsWith("mock-")) {
        await deleteZoomMeeting(zoomMeetingId, "B").catch(console.error)
      }
      if (googleEventId && !googleEventId.startsWith("mock-")) {
        await deleteCalendarEvent(googleEventId).catch(console.error)
      }
      return NextResponse.json(
        { error: "予約の作成に失敗しました" },
        { status: 500 }
      )
    }

    bookingId = data.id
    console.log("[Guest Booking] Booking created:", bookingId)

    // Step 4: Generate cancel token
    const cancelToken = await generateCancelToken(bookingId, normalizedEmail)

    // Step 5: Send confirmation email (non-critical)
    console.log("[Guest Booking] Step 5: Sending confirmation email")
    try {
      const cancelUrl = `${APP_BASE_URL}/guest/cancel/${cancelToken}`
      const googleCalendarUrl = generateGoogleCalendarUrl(
        `${CASUAL_30_NAME} - ${trimmedName}`,
        startTime,
        endTime
      )

      await sendBookingConfirmationEmail({
        userEmail: normalizedEmail,
        userName: trimmedName,
        sessionTitle: CASUAL_30_NAME,
        startTime: startTime,
        endTime: endTime,
        zoomJoinUrl: "", // ゲスト予約ではZoom URLをメールに含めない（mockの場合があるため）
        cancelUrl,
        googleCalendarUrl,
      })
      console.log("[Guest Booking] Confirmation email sent")
    } catch (error) {
      // Email is non-critical, log and continue
      console.warn("[Guest Booking] Email sending failed (non-critical):", error)
    }

    // 成功
    console.log("[Guest Booking] Booking completed successfully:", bookingId)
    return NextResponse.json(
      {
        booking_id: bookingId,
        guest_token: guestToken,
        cancel_token: cancelToken,
      },
      {
        status: 201,
        headers: {
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          "X-RateLimit-Reset": String(rateLimit.resetAt),
        },
      }
    )
  } catch (error) {
    console.error("[Guest Booking] Unexpected error:", error)

    // Cleanup on unexpected error
    if (zoomMeetingId && !zoomMeetingId.startsWith("mock-")) {
      await deleteZoomMeeting(zoomMeetingId, "B").catch(console.error)
    }
    if (googleEventId && !googleEventId.startsWith("mock-")) {
      await deleteCalendarEvent(googleEventId).catch(console.error)
    }

    return NextResponse.json(
      { error: "予約処理中にエラーが発生しました" },
      { status: 500 }
    )
  }
}
