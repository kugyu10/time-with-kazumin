/**
 * GET /api/admin/oauth/google
 *
 * Google OAuth認証URL取得API（管理者専用）
 * フロントエンドからこのAPIを呼び出し、返されたURLにリダイレクトして認証を開始
 */

import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getAuthUrl, isConfigured } from "@/lib/integrations/oauth/google"
import type { Database } from "@/types/database"

export async function GET() {
  try {
    // Google OAuth認証情報が設定されているか確認
    if (!isConfigured()) {
      return NextResponse.json(
        { error: "Google OAuth認証情報が設定されていません" },
        { status: 503 }
      )
    }

    // ユーザー認証チェック
    const cookieStore = await cookies()
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch {
              // Server Componentからの呼び出し時は無視
            }
          },
        },
      }
    )

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

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "プロフィール情報が見つかりません" },
        { status: 403 }
      )
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      )
    }

    // 認証URL生成
    const authUrl = getAuthUrl()
    if (!authUrl) {
      return NextResponse.json(
        { error: "認証URL生成に失敗しました" },
        { status: 500 }
      )
    }

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error("[GET /api/admin/oauth/google] Error:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
