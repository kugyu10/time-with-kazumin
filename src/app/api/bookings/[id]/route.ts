import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cancelBooking } from "@/lib/bookings/cancel"

// GET: 予約詳細取得（RLS適用で本人のみ）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bookingId = parseInt(id, 10)

    if (isNaN(bookingId)) {
      return NextResponse.json(
        { error: "無効な予約IDです", code: "invalid_id" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "認証が必要です", code: "unauthorized" },
        { status: 401 }
      )
    }

    // RLSで本人の予約のみ取得可能
    const { data: booking, error } = await supabase
      .from("bookings")
      .select(`
        id,
        member_plan_id,
        menu_id,
        start_time,
        end_time,
        status,
        zoom_join_url,
        created_at,
        meeting_menus (
          id,
          name,
          duration_minutes,
          points_required
        ),
        member_plans (
          id,
          user_id,
          current_points
        )
      `)
      .eq("id", bookingId)
      .single()

    if (error || !booking) {
      return NextResponse.json(
        { error: "予約が見つかりません", code: "not_found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ booking })
  } catch (error) {
    console.error("[GET /api/bookings/[id]] Error:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました", code: "server_error" },
      { status: 500 }
    )
  }
}

// DELETE: 予約キャンセル
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bookingId = parseInt(id, 10)

    if (isNaN(bookingId)) {
      return NextResponse.json(
        { error: "無効な予約IDです", code: "invalid_id" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "認証が必要です", code: "unauthorized" },
        { status: 401 }
      )
    }

    // キャンセル処理実行
    const result = await cancelBooking(bookingId, supabase, user.id)

    if (!result.success) {
      const statusCode =
        result.error_code === "not_found" ? 404 :
        result.error_code === "forbidden" ? 403 :
        400

      return NextResponse.json(
        { error: result.error, code: result.error_code },
        { status: statusCode }
      )
    }

    return NextResponse.json({
      success: true,
      refunded_points: result.refunded_points
    })
  } catch (error) {
    console.error("[DELETE /api/bookings/[id]] Error:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました", code: "server_error" },
      { status: 500 }
    )
  }
}
