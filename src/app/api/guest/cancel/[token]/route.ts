/**
 * DELETE /api/guest/cancel/[token]
 *
 * ゲストキャンセルAPI
 * JWTトークンで認証し、cancelBookingオーケストレーターで
 * Zoom/Calendar削除とメール送信を含むキャンセルを実行
 */

import { NextResponse } from "next/server"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"
import { verifyCancelToken } from "@/lib/tokens/cancel-token"
import { cancelBooking } from "@/lib/bookings/cancel"

interface RouteParams {
  params: Promise<{ token: string }>
}

export async function DELETE(
  request: Request,
  { params }: RouteParams
) {
  const { token } = await params

  // 1. トークン検証
  const payload = await verifyCancelToken(token)
  if (!payload) {
    return NextResponse.json(
      { error: "無効または期限切れのリンクです" },
      { status: 401 }
    )
  }

  const { booking_id, email } = payload

  // 2. 予約を取得（メールアドレス照合のため）
  const supabase = getSupabaseServiceRole()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error: fetchError } = await (supabase as any)
    .from("bookings")
    .select("id, guest_email, guest_name, status, start_time")
    .eq("id", booking_id)
    .single() as {
      data: {
        id: number
        guest_email: string | null
        guest_name: string | null
        status: string
        start_time: string
      } | null
      error: { message: string } | null
    }

  if (fetchError || !booking) {
    console.error("[DELETE /api/guest/cancel] Fetch error:", fetchError)
    return NextResponse.json(
      { error: "予約が見つかりません" },
      { status: 404 }
    )
  }

  // 3. メールアドレスの照合
  if (booking.guest_email?.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json(
      { error: "無効なリンクです" },
      { status: 401 }
    )
  }

  // 4. cancelBookingオーケストレーターでキャンセル実行
  // (Zoom/Calendar削除、メール送信を含む)
  const result = await cancelBooking(booking_id, supabase, undefined, {
    isGuest: true,
    guestEmail: booking.guest_email || undefined,
    guestName: booking.guest_name || undefined,
  })

  if (!result.success) {
    const statusCode =
      result.error_code === "not_found" ? 404 :
      result.error_code === "already_canceled" ? 400 :
      result.error_code === "past_booking" ? 400 :
      500

    return NextResponse.json(
      { error: result.error },
      { status: statusCode }
    )
  }

  return NextResponse.json(
    { success: true, message: "予約をキャンセルしました" },
    { status: 200 }
  )
}
