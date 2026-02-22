/**
 * Booking Cancellation Orchestrator
 *
 * Handles cancellation with:
 * - Point refund (members only)
 * - Zoom meeting deletion
 * - Google Calendar event deletion
 * - Cancellation email notification
 *
 * External API failures do NOT block cancellation - booking is always canceled
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { deleteZoomMeeting as deleteZoomMeetingApi } from "@/lib/integrations/zoom"
import { deleteCalendarEvent as deleteCalendarEventApi } from "@/lib/integrations/google-calendar"
import { sendBookingCancellationEmail } from "@/lib/integrations/email"
import { retryWithExponentialBackoff } from "@/lib/utils/retry"

export type CancelBookingResult = {
  success: boolean
  refunded_points?: number
  error?: string
  error_code?: string
}

// 型定義
type BookingWithRelations = {
  id: number
  member_plan_id: number | null
  menu_id: number
  status: "confirmed" | "completed" | "canceled"
  start_time: string
  end_time: string
  zoom_meeting_id: string | null
  google_event_id: string | null
  guest_email: string | null
  guest_name: string | null
  member_plans: {
    id: number
    user_id: string
    current_points: number
  } | null
  meeting_menus: {
    name: string
    points_required: number
  } | null
}

export interface CancelBookingOptions {
  isGuest?: boolean
  guestEmail?: string
  guestName?: string
}

/**
 * Cancel a booking with full cleanup
 *
 * For members: validates ownership via userId
 * For guests: validates via options.isGuest flag (caller must verify token)
 *
 * Processing order:
 * 1. Fetch booking data
 * 2. Validate permissions and status
 * 3. Refund points (members only)
 * 4. Delete Zoom meeting (non-blocking)
 * 5. Delete Calendar event (non-blocking)
 * 6. Update booking status to 'canceled'
 * 7. Send cancellation email (non-blocking)
 */
export async function cancelBooking(
  bookingId: number,
  supabase: SupabaseClient<Database>,
  userId?: string,
  options: CancelBookingOptions = {}
): Promise<CancelBookingResult> {
  const { isGuest = false, guestEmail, guestName } = options

  try {
    // 1. 予約取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: bookingError } = await (supabase as any)
      .from("bookings")
      .select(`
        id,
        member_plan_id,
        menu_id,
        status,
        start_time,
        end_time,
        zoom_meeting_id,
        google_event_id,
        guest_email,
        guest_name,
        member_plans (
          id,
          user_id,
          current_points
        ),
        meeting_menus (
          name,
          points_required
        )
      `)
      .eq("id", bookingId)
      .single() as { data: BookingWithRelations | null; error: Error | null }

    if (bookingError || !data) {
      console.error("[cancelBooking] Booking not found:", bookingError)
      return { success: false, error: "予約が見つかりません", error_code: "not_found" }
    }

    const booking = data

    // 2. 権限チェック
    if (!isGuest) {
      // 会員キャンセル: member_plans経由でuser_id確認
      if (!booking.member_plans || booking.member_plans.user_id !== userId) {
        console.error("[cancelBooking] Unauthorized access attempt:", { bookingId, userId })
        return { success: false, error: "この予約をキャンセルする権限がありません", error_code: "forbidden" }
      }
    }
    // ゲストの場合は呼び出し元でトークン検証済みと想定

    // 3. ステータス確認
    if (booking.status === "canceled") {
      return { success: false, error: "この予約は既にキャンセル済みです", error_code: "already_canceled" }
    }
    if (booking.status === "completed") {
      return { success: false, error: "完了した予約はキャンセルできません", error_code: "already_completed" }
    }

    // 4. 過去の予約チェック
    const now = new Date()
    const startTime = new Date(booking.start_time)
    if (startTime < now) {
      return { success: false, error: "過去の予約はキャンセルできません", error_code: "past_booking" }
    }

    // 5. ポイント返還（会員のみ）
    const menuInfo = booking.meeting_menus
    const pointsToRefund = menuInfo?.points_required ?? 0
    let refundedPoints = 0

    if (!isGuest && pointsToRefund > 0 && booking.member_plan_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newBalance, error: refundError } = await (supabase.rpc as any)("refund_points", {
        p_member_plan_id: booking.member_plan_id,
        p_points: pointsToRefund,
        p_reference_id: booking.id,
        p_notes: `予約キャンセル (booking_id: ${booking.id})`
      }) as { data: number | null; error: Error | null }

      if (refundError) {
        console.error("[cancelBooking] Point refund failed:", refundError)
        return { success: false, error: "ポイント返還に失敗しました", error_code: "refund_failed" }
      }

      refundedPoints = pointsToRefund
      console.log(`[cancelBooking] Points refunded: ${pointsToRefund}, new balance: ${newBalance}`)
    }

    // 6. Zoom会議削除（非ブロッキング - 失敗してもキャンセルは続行）
    if (booking.zoom_meeting_id) {
      try {
        await retryWithExponentialBackoff(
          () => deleteZoomMeetingApi(booking.zoom_meeting_id!),
          { maxRetries: 2 }
        )
        console.log(`[cancelBooking] Zoom meeting deleted: ${booking.zoom_meeting_id}`)
      } catch (error) {
        console.warn("[cancelBooking] Zoom deletion failed (non-blocking):", error)
      }
    }

    // 7. Googleカレンダーイベント削除（非ブロッキング）
    if (booking.google_event_id) {
      try {
        await retryWithExponentialBackoff(
          () => deleteCalendarEventApi(booking.google_event_id!),
          { maxRetries: 2 }
        )
        console.log(`[cancelBooking] Calendar event deleted: ${booking.google_event_id}`)
      } catch (error) {
        console.warn("[cancelBooking] Calendar deletion failed (non-blocking):", error)
      }
    }

    // 8. 予約ステータス更新（必須）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("bookings")
      .update({ status: "canceled" })
      .eq("id", bookingId)

    if (updateError) {
      console.error("[cancelBooking] Status update failed:", updateError)
      return {
        success: false,
        error: "予約ステータスの更新に失敗しました。",
        error_code: "status_update_failed",
        refunded_points: refundedPoints
      }
    }

    // 9. キャンセルメール送信（非ブロッキング）
    const sessionTitle = menuInfo?.name ?? "セッション"
    let userEmail: string | null = null
    let userName: string | null = null

    if (isGuest) {
      userEmail = guestEmail || booking.guest_email
      userName = guestName || booking.guest_name || "ゲスト"
    } else if (userId) {
      // 会員の場合はprofilesからメールを取得
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("email, display_name")
        .eq("id", userId)
        .single() as { data: { email: string; display_name: string | null } | null }

      if (profile) {
        userEmail = profile.email
        userName = profile.display_name || "会員"
      }
    }

    if (userEmail) {
      try {
        await sendBookingCancellationEmail({
          userEmail,
          userName: userName || "ゲスト",
          sessionTitle,
          originalStartTime: booking.start_time,
          originalEndTime: booking.end_time,
          isGuest,
          pointsRefunded: refundedPoints > 0 ? refundedPoints : undefined,
        })
        console.log(`[cancelBooking] Cancellation email sent to: ${userEmail}`)
      } catch (error) {
        console.warn("[cancelBooking] Email sending failed (non-blocking):", error)
      }
    }

    return { success: true, refunded_points: refundedPoints }
  } catch (error) {
    console.error("[cancelBooking] Unexpected error:", error)
    return {
      success: false,
      error: "キャンセル処理中にエラーが発生しました",
      error_code: "unexpected_error"
    }
  }
}
