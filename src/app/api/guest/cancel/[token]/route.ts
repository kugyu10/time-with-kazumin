/**
 * DELETE /api/guest/cancel/[token]
 *
 * ゲストキャンセルAPI
 * JWTトークンで認証し、予約をキャンセル
 */

import { NextResponse } from "next/server"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"
import { verifyCancelToken } from "@/lib/tokens/cancel-token"

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

  // 2. 予約を取得
  const supabase = getSupabaseServiceRole()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error: fetchError } = await (supabase as any)
    .from("bookings")
    .select("id, guest_email, status, start_time")
    .eq("id", booking_id)
    .single() as {
      data: { id: number; guest_email: string; status: string; start_time: string } | null
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

  // 4. 既にキャンセル済みかチェック
  if (booking.status === "canceled") {
    return NextResponse.json(
      { error: "この予約は既にキャンセルされています" },
      { status: 400 }
    )
  }

  // 5. 予約開始時刻を過ぎていないかチェック
  const startTime = new Date(booking.start_time)
  if (startTime < new Date()) {
    return NextResponse.json(
      { error: "予約開始時刻を過ぎているためキャンセルできません" },
      { status: 400 }
    )
  }

  // 6. キャンセル実行
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("bookings")
    .update({ status: "canceled" })
    .eq("id", booking_id) as { error: { message: string } | null }

  if (updateError) {
    console.error("[DELETE /api/guest/cancel] Update error:", updateError)
    return NextResponse.json(
      { error: "キャンセル処理に失敗しました" },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { success: true, message: "予約をキャンセルしました" },
    { status: 200 }
  )
}
