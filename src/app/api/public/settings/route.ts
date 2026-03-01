/**
 * GET /api/public/settings
 *
 * 公開設定の取得（認証不要）
 * 予約画面などで必要な設定のみ公開
 */

import { NextResponse } from "next/server"
import { getBookingMinHoursAhead } from "@/lib/settings/app-settings"

/**
 * GET: 公開設定を取得
 */
export async function GET() {
  try {
    const bookingMinHoursAhead = await getBookingMinHoursAhead()

    return NextResponse.json({
      booking_min_hours_ahead: bookingMinHoursAhead,
    })
  } catch (error) {
    console.error("[GET /api/public/settings] Error:", error)
    return NextResponse.json(
      { error: "設定の取得に失敗しました" },
      { status: 500 }
    )
  }
}
