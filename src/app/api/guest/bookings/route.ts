/**
 * POST /api/guest/bookings
 *
 * ゲスト予約作成API
 * 認証なしでカジュアル30分セッションを予約
 */

import { NextResponse } from "next/server"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"
import { checkGuestRateLimit } from "@/lib/rate-limit/guest-limiter"
import { validateGuestBooking } from "@/lib/validation/guest"
import { randomUUID } from "crypto"

// カジュアル30分セッションのメニューID（固定）
const CASUAL_30_MENU_ID = 1

export async function POST(request: Request) {
  try {
    // IPアドレスの取得
    const forwardedFor = request.headers.get("x-forwarded-for")
    const ip = forwardedFor?.split(",")[0]?.trim() || "127.0.0.1"

    // リクエストボディの解析
    const body = await request.json()
    const { email, name, slotDate, startTime, endTime } = body as {
      email?: string
      name?: string
      slotDate?: string
      startTime?: string
      endTime?: string
    }

    // 基本的な必須フィールドチェック
    if (!email || !name || !slotDate || !startTime || !endTime) {
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
    const validation = validateGuestBooking({ email, name, slotDate, startTime, endTime })
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(", ") },
        { status: 400 }
      )
    }

    // ゲストトークン生成
    const guestToken = randomUUID()

    // 予約作成（service_roleでRLSバイパス）
    const supabase = getSupabaseServiceRole()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("bookings")
      .insert({
        menu_id: CASUAL_30_MENU_ID,
        guest_email: email.toLowerCase().trim(),
        guest_name: name.trim(),
        guest_token: guestToken,
        start_time: startTime,
        end_time: endTime,
        status: "confirmed",
        member_plan_id: null, // ゲスト予約はmember_plan_idなし
      })
      .select("id")
      .single() as { data: { id: number } | null; error: { code: string; message: string } | null }

    if (error) {
      console.error("[POST /api/guest/bookings] Insert error:", error)

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
      return NextResponse.json(
        { error: "予約の作成に失敗しました" },
        { status: 500 }
      )
    }

    // 成功
    return NextResponse.json(
      {
        booking_id: data.id,
        guest_token: guestToken,
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
    console.error("[POST /api/guest/bookings] Error:", error)
    return NextResponse.json(
      { error: "予約処理中にエラーが発生しました" },
      { status: 500 }
    )
  }
}
