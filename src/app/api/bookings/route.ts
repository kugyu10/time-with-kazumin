import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createBookingSaga } from "@/lib/bookings/saga"
import {
  checkIdempotencyKey,
  saveIdempotencyKey,
  hashRequest,
  generateIdempotencyKey,
  IdempotencyConflictError,
} from "@/lib/utils/idempotency"
import type { BookingRequest } from "@/lib/bookings/types"

/**
 * POST /api/bookings
 * Create a new booking with Saga pattern
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body = await request.json()
    const { menu_id, start_time, end_time } = body as {
      menu_id: number
      start_time: string
      end_time: string
    }

    if (!menu_id || !start_time || !end_time) {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 }
      )
    }

    // 3. Get member_plan for current user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: memberPlan, error: planError } = await (supabase as any)
      .from("member_plans")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single() as { data: { id: number } | null; error: Error | null }

    if (planError || !memberPlan) {
      return NextResponse.json(
        { error: "有効な会員プランが見つかりません" },
        { status: 403 }
      )
    }

    // 4. Get idempotency key from header or generate one
    const idempotencyKey = request.headers.get("Idempotency-Key") || generateIdempotencyKey()

    // 5. Create request hash for idempotency check
    const requestBody = {
      member_plan_id: memberPlan.id,
      menu_id,
      start_time,
      end_time,
    }
    const requestHash = await hashRequest(requestBody)

    // 6. Check idempotency key
    const idempotencyResult = await checkIdempotencyKey(supabase, idempotencyKey, requestHash)

    if (idempotencyResult.exists) {
      if (idempotencyResult.conflict) {
        throw new IdempotencyConflictError()
      }
      // Return cached response
      return NextResponse.json(idempotencyResult.response, {
        headers: { "Idempotency-Key": idempotencyKey },
      })
    }

    // 7. Execute Saga
    const bookingRequest: BookingRequest = {
      member_plan_id: memberPlan.id,
      menu_id,
      start_time,
      end_time,
      idempotency_key: idempotencyKey,
    }

    const result = await createBookingSaga(bookingRequest, supabase, user.id)

    // 8. Handle result
    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: result.errorCode },
        { status: 400 }
      )
    }

    // 9. Save idempotency key
    if (result.booking) {
      await saveIdempotencyKey(supabase, idempotencyKey, requestHash, {
        booking: result.booking,
      })
    }

    // 10. Return success response
    return NextResponse.json(
      { booking: result.booking },
      {
        status: 201,
        headers: { "Idempotency-Key": idempotencyKey },
      }
    )
  } catch (error) {
    console.error("[POST /api/bookings] Error:", error)

    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json(
        { error: "同じリクエストキーで異なる内容のリクエストが送信されました" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "予約処理中にエラーが発生しました" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/bookings
 * List bookings for current user
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    // 2. Get member_plan
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: memberPlan, error: planError } = await (supabase as any)
      .from("member_plans")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single() as { data: { id: number } | null; error: Error | null }

    if (planError || !memberPlan) {
      return NextResponse.json(
        { error: "有効な会員プランが見つかりません" },
        { status: 403 }
      )
    }

    // 3. Get bookings with menu info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookings, error: bookingsError } = await (supabase as any)
      .from("bookings")
      .select(`
        id,
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
        )
      `)
      .eq("member_plan_id", memberPlan.id)
      .order("start_time", { ascending: true }) as { data: unknown[] | null; error: Error | null }

    if (bookingsError) {
      console.error("[GET /api/bookings] Error:", bookingsError)
      return NextResponse.json(
        { error: "予約一覧の取得に失敗しました" },
        { status: 500 }
      )
    }

    return NextResponse.json({ bookings: bookings || [] })
  } catch (error) {
    console.error("[GET /api/bookings] Error:", error)
    return NextResponse.json(
      { error: "予約一覧の取得に失敗しました" },
      { status: 500 }
    )
  }
}
