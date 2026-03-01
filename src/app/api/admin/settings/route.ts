/**
 * GET/PUT /api/admin/settings
 *
 * アプリ設定の取得・更新（管理者専用）
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAppSettings, setAppSetting, SETTING_KEYS } from "@/lib/settings/app-settings"

// 取得対象のキー一覧
const ALLOWED_KEYS: string[] = [
  SETTING_KEYS.BOOKING_MIN_HOURS_AHEAD,
]

/**
 * GET: アプリ設定を取得
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 管理者チェック
    const role = user.app_metadata?.role
    if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const settings = await getAppSettings(ALLOWED_KEYS)

    return NextResponse.json({ settings })
  } catch (error) {
    console.error("[GET /api/admin/settings] Error:", error)
    return NextResponse.json(
      { error: "設定の取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * PUT: アプリ設定を更新
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 管理者チェック
    const role = user.app_metadata?.role
    if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { key, value } = body as { key?: string; value?: string }

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "key と value は必須です" },
        { status: 400 }
      )
    }

    // 許可されたキーのみ更新可能
    if (!ALLOWED_KEYS.includes(key)) {
      return NextResponse.json(
        { error: "不正な設定キーです" },
        { status: 400 }
      )
    }

    // booking_min_hours_ahead のバリデーション
    if (key === SETTING_KEYS.BOOKING_MIN_HOURS_AHEAD) {
      const numValue = Number(value)
      if (isNaN(numValue) || numValue < 0 || numValue > 168) {
        return NextResponse.json(
          { error: "予約可能時間は0〜168時間の範囲で設定してください" },
          { status: 400 }
        )
      }
    }

    const success = await setAppSetting(key, value)

    if (!success) {
      return NextResponse.json(
        { error: "設定の更新に失敗しました" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[PUT /api/admin/settings] Error:", error)
    return NextResponse.json(
      { error: "設定の更新に失敗しました" },
      { status: 500 }
    )
  }
}
