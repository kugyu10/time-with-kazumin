import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/layout/Header"

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

  // Get current points for header
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberPlan } = await (supabase as any)
    .from("member_plans")
    .select("current_points")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single() as { data: { current_points: number } | null }

  const currentPoints = memberPlan?.current_points ?? 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50">
      <Header currentPoints={currentPoints} />
      <main>{children}</main>
    </div>
  )
}
