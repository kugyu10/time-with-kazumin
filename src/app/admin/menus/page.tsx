import { getMenus } from "@/lib/actions/admin/menus"
import { MenusClient } from "./menus-client"

export default async function MenusPage() {
  const menus = await getMenus()

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

      <MenusClient initialMenus={menus} />
    </div>
  )
}
