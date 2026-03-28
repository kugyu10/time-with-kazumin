"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DataTable } from "@/components/ui/data-table"
import { getColumns, type Menu } from "./columns"
import { MenuForm } from "@/components/admin/forms/menu-form"
import { deleteMenu } from "@/lib/actions/admin/menus"

type MenusClientProps = {
  initialMenus: Menu[]
  plans: Array<{ id: number; name: string }>
}

export function MenusClient({ initialMenus, plans }: MenusClientProps) {
  const [menus, setMenus] = useState<Menu[]>(initialMenus)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
  const [deletingMenu, setDeletingMenu] = useState<Menu | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleEdit = (menu: Menu) => {
    setEditingMenu(menu)
  }

  const handleDelete = (menu: Menu) => {
    setDeletingMenu(menu)
  }

  const confirmDelete = () => {
    if (!deletingMenu) return

    startTransition(async () => {
      try {
        await deleteMenu(deletingMenu.id)
        setMenus((prev) =>
          prev.map((m) =>
            m.id === deletingMenu.id ? { ...m, is_active: false } : m
          )
        )
        setDeletingMenu(null)
      } catch (error) {
        console.error("Delete failed:", error)
      }
    })
  }

  const handleCreateSuccess = () => {
    setIsCreateOpen(false)
    // Page will revalidate and show new data
    window.location.reload()
  }

  const handleEditSuccess = () => {
    setEditingMenu(null)
    window.location.reload()
  }

  const columns = getColumns({
    onEdit: handleEdit,
    onDelete: handleDelete,
  })

  return (
    <>
      <div className="flex justify-end">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新規作成
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>メニュー作成</DialogTitle>
              <DialogDescription>
                新しいセッションメニューを作成します
              </DialogDescription>
            </DialogHeader>
            <MenuForm
              plans={plans}
              onSuccess={handleCreateSuccess}
              onCancel={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <DataTable columns={columns} data={menus} />

      {/* Edit Dialog */}
      <Dialog open={!!editingMenu} onOpenChange={() => setEditingMenu(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>メニュー編集</DialogTitle>
            <DialogDescription>
              メニュー情報を編集します
            </DialogDescription>
          </DialogHeader>
          {editingMenu && (
            <MenuForm
              menu={editingMenu}
              plans={plans}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingMenu(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingMenu} onOpenChange={() => setDeletingMenu(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>メニューを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deletingMenu?.name}」を削除します。この操作はメニューを無効化します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "削除中..." : "削除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
