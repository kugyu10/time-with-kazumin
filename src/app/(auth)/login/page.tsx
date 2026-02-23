import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton"
import { LoginForm } from "@/components/auth/LoginForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 認証済みの場合は予約ページへリダイレクト
  if (user) {
    redirect("/bookings/new")
  }

  const params = await searchParams
  const error = params.error

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-yellow-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-orange-100">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold text-orange-600">
            かずみん、時間空いてる？
          </CardTitle>
          <p className="text-gray-600 mt-2">
            かずみんに会いに行こう
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* エラーメッセージ */}
          {error === "auth_error" && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              認証に失敗しました。もう一度お試しください。
            </div>
          )}
          {error === "not_invited" && (
            <div className="bg-yellow-50 text-yellow-700 p-3 rounded-md text-sm">
              招待されたユーザーのみログインできます。
              かずみんにご連絡ください。
            </div>
          )}

          {/* Google OAuth（優先） */}
          <div>
            <GoogleSignInButton />
          </div>

          {/* 区切り線 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">または</span>
            </div>
          </div>

          {/* メール/パスワード（代替） */}
          <div>
            <LoginForm />
          </div>

          {/* 招待制の注意書き */}
          <p className="text-center text-xs text-gray-400">
            このサービスは招待制です。
            <br />
            招待を受けた方のみログインできます。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
