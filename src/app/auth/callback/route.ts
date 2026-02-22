import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error("Auth callback error:", error)
      return NextResponse.redirect(`${origin}/login?error=auth_error`)
    }

    // 認証成功 - 予約ページへリダイレクト
    return NextResponse.redirect(`${origin}/bookings/new`)
  }

  // codeがない場合はエラー
  return NextResponse.redirect(`${origin}/login?error=auth_error`)
}
