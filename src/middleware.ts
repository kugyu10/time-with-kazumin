import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

// 保護対象のパス
const protectedPaths = ["/dashboard", "/bookings"]

// ログインページのパス
const authPaths = ["/login"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // セッションをリフレッシュしてユーザー情報を取得
  const { supabaseResponse, user } = await updateSession(request)

  // 保護対象パスへの未認証アクセス
  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path)
  )
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // 認証済みユーザーがログインページにアクセス
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path))
  if (isAuthPath && user) {
    const url = request.nextUrl.clone()
    url.pathname = "/bookings/new"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのリクエストパスにマッチ:
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化ファイル)
     * - favicon.ico (ファビコン)
     * - 画像ファイル
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
