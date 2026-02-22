import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

export type CancelBookingResult = {
  success: boolean
  refunded_points?: number
  error?: string
  error_code?: string
}

// モック関数: Zoom会議削除
async function deleteZoomMeeting(meetingId: string | null): Promise<void> {
  if (!meetingId) return
  // Phase 4で実装: Zoom API連携
  console.log(`[MOCK] Zoom meeting ${meetingId} deleted`)
}

// モック関数: Googleカレンダーイベント削除
async function deleteCalendarEvent(eventId: string | null): Promise<void> {
  if (!eventId) return
  // Phase 4で実装: Google Calendar API連携
  console.log(`[MOCK] Google Calendar event ${eventId} deleted`)
}

// モック関数: キャンセルメール送信
async function sendCancelEmail(email: string, bookingId: number): Promise<void> {
  // Phase 5で実装: SendGrid/Resend連携
  console.log(`[MOCK] Cancel email sent to ${email} for booking ${bookingId}`)
}

// 型定義
type BookingWithRelations = {
  id: number
  member_plan_id: number | null
  menu_id: number
  status: "confirmed" | "completed" | "canceled"
  start_time: string
  zoom_meeting_id: string | null
  google_event_id: string | null
  member_plans: {
    id: number
    user_id: string
    current_points: number
  }
  meeting_menus: {
    points_required: number
  } | null
}

export async function cancelBooking(
  bookingId: number,
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CancelBookingResult> {
  try {
    // 1. 予約取得（member_plans JOINでuser_id確認）
    const { data, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id,
        member_plan_id,
        menu_id,
        status,
        start_time,
        zoom_meeting_id,
        google_event_id,
        member_plans!inner (
          id,
          user_id,
          current_points
        ),
        meeting_menus (
          points_required
        )
      `)
      .eq("id", bookingId)
      .single()

    if (bookingError || !data) {
      console.error("[cancelBooking] Booking not found:", bookingError)
      return { success: false, error: "予約が見つかりません", error_code: "not_found" }
    }

    // 型アサーション（Supabaseの結合クエリは型推論が複雑なため）
    const booking = data as unknown as BookingWithRelations

    // 2. 権限チェック（本人確認）
    // RLSも適用されているが、念のためダブルチェック
    if (booking.member_plans.user_id !== userId) {
      console.error("[cancelBooking] Unauthorized access attempt:", { bookingId, userId })
      return { success: false, error: "この予約をキャンセルする権限がありません", error_code: "forbidden" }
    }

    // 3. ステータス確認（confirmed/pendingのみキャンセル可）
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

    // 5. ポイント返還
    const menuInfo = booking.meeting_menus as { points_required: number } | null
    const pointsToRefund = menuInfo?.points_required ?? 0
    let refundedPoints = 0

    if (pointsToRefund > 0 && booking.member_plan_id) {
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

    // 6. Zoom会議削除（モック）
    await deleteZoomMeeting(booking.zoom_meeting_id)

    // 7. Googleカレンダーイベント削除（モック）
    await deleteCalendarEvent(booking.google_event_id)

    // 8. 予約ステータス更新
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("bookings")
      .update({ status: "canceled" })
      .eq("id", bookingId)

    if (updateError) {
      console.error("[cancelBooking] Status update failed:", updateError)
      // ポイントは既に返還されているが、ステータス更新失敗
      // ログして例外をthrow（補償トランザクションが必要だが、ここでは単純にエラー返却）
      return {
        success: false,
        error: "予約ステータスの更新に失敗しました。ポイントは返還されました。",
        error_code: "status_update_failed",
        refunded_points: refundedPoints
      }
    }

    // 9. キャンセルメール送信（モック）
    // ユーザーのメールアドレスを取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single() as { data: { email: string } | null }

    if (profile?.email) {
      await sendCancelEmail(profile.email, bookingId)
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
