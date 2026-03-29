import { getMenus } from "@/lib/actions/admin/menus"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"
import { MenusClient } from "./menus-client"

export default async function MenusPage() {
  const menus = await getMenus()
  const supabase = getSupabaseServiceRole()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plans } = await (supabase as any)
    .from("plans")
    .select("id, name")
    .eq("is_active", true)
    .order("id", { ascending: true }) as { data: Array<{ id: number; name: string }> | null; error: unknown }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">メニュー管理</h1>
          <p className="text-muted-foreground mt-2">
            セッションメニューの作成・編集・削除ができます
          </p>
        </div>
      </div>

      <MenusClient initialMenus={menus} plans={plans ?? []} />
    </div>
  )
}
