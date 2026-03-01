/**
 * GET /api/admin/zoom/status
 *
 * Zoom連携状態確認API（管理者専用）
 * 各アカウントの設定状態とトークン取得可否をチェック
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isZoomConfigured, getZoomAccessToken } from "@/lib/integrations/zoom"

type AccountStatus = {
  configured: boolean
  connected: boolean
  error?: string
}

export async function GET() {
  try {
    // ユーザー認証チェック
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    // 管理者権限チェック
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: { role: string } | null; error: Error | null }

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      )
    }

    // Zoom A の状態チェック
    const accountA = await checkAccountStatus("A")

    // Zoom B の状態チェック
    const accountB = await checkAccountStatus("B")

    return NextResponse.json({
      accountA,
      accountB,
    })
  } catch (error) {
    console.error("[GET /api/admin/zoom/status] Error:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}

async function checkAccountStatus(accountType: "A" | "B"): Promise<AccountStatus> {
  const configured = isZoomConfigured(accountType)

  if (!configured) {
    return { configured: false, connected: false }
  }

  try {
    // トークン取得を試みる
    await getZoomAccessToken(accountType)
    return { configured: true, connected: true }
  } catch (error) {
    return {
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : "接続エラー",
    }
  }
}
