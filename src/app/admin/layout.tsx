import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminSidebar } from "@/components/admin/sidebar"

/**
 * Admin Layout
 *
 * 管理画面の共通レイアウト。
 * Server Componentで認証・認可チェックを実施（CVE-2025-29927対策）。
 * Middlewareだけでなく、ここでも必ずチェックを行う。
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 認証チェック
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // 認可チェック: profilesテーブルでrole確認
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error: profileError } = await (supabase as any)
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single() as { data: { id: string; role: string } | null; error: unknown }

  // 管理者でない場合はホームにリダイレクト
  if (profileError || !profile || profile.role !== "admin") {
    redirect("/")
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  )
}
