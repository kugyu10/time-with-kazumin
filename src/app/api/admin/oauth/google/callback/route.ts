/**
 * GET /api/admin/oauth/google/callback
 *
 * Google OAuth コールバック処理
 * Googleからの認証完了リダイレクト先
 * 認証コードからトークンを取得してDBに保存
 */

import { NextRequest, NextResponse } from "next/server"
import { getTokensFromCode } from "@/lib/integrations/oauth/google"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  // エラーパラメータがある場合（ユーザーがキャンセルした等）
  if (error) {
    console.log("[GoogleOAuth Callback] Auth error:", error)
    return NextResponse.redirect(
      new URL(
        `/admin/settings?error=oauth_denied&message=${encodeURIComponent(error)}`,
        request.nextUrl.origin
      )
    )
  }

  // 認証コードがない場合
  if (!code) {
    console.error("[GoogleOAuth Callback] No code parameter")
    return NextResponse.redirect(
      new URL("/admin/settings?error=oauth_failed&message=no_code", request.nextUrl.origin)
    )
  }

  try {
    // 認証コードからトークンを取得してDBに保存
    await getTokensFromCode(code)
    console.log("[GoogleOAuth Callback] Successfully stored tokens")

    // 成功時は設定ページにリダイレクト
    return NextResponse.redirect(
      new URL("/admin/settings?oauth=success", request.nextUrl.origin)
    )
  } catch (err) {
    console.error("[GoogleOAuth Callback] Error:", err)
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error"

    return NextResponse.redirect(
      new URL(
        `/admin/settings?error=oauth_failed&message=${encodeURIComponent(errorMessage)}`,
        request.nextUrl.origin
      )
    )
  }
}
