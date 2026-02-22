import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 未認証の場合はログインページへ
  if (!user) {
    redirect("/login")
  }

  // 招待制チェック: profilesテーブルに存在するか確認
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    // profilesに存在しない = 招待されていない
    // ログアウトしてエラー表示
    await supabase.auth.signOut()
    redirect("/login?error=not_invited")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50">
      {/* ヘッダー - Phase 2 Plan 02で実装予定 */}
      <main>{children}</main>
    </div>
  )
}
