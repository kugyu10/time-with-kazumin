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
import { getColumns, type Plan } from "./columns"
import { PlanForm } from "@/components/admin/forms/plan-form"
import { deletePlan } from "@/lib/actions/admin/plans"

type PlansClientProps = {
  initialPlans: Plan[]
}

export function PlansClient({ initialPlans }: PlansClientProps) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan)
  }

  const handleDelete = (plan: Plan) => {
    setDeletingPlan(plan)
  }

  const confirmDelete = () => {
    if (!deletingPlan) return

    startTransition(async () => {
      try {
        await deletePlan(deletingPlan.id)
        setPlans((prev) =>
          prev.map((p) =>
            p.id === deletingPlan.id ? { ...p, is_active: false } : p
          )
        )
        setDeletingPlan(null)
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
    setEditingPlan(null)
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
              <DialogTitle>プラン作成</DialogTitle>
              <DialogDescription>
                新しいサブスクリプションプランを作成します
              </DialogDescription>
            </DialogHeader>
            <PlanForm
              onSuccess={handleCreateSuccess}
              onCancel={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <DataTable columns={columns} data={plans} />

      {/* Edit Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={() => setEditingPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>プラン編集</DialogTitle>
            <DialogDescription>
              プラン情報を編集します
            </DialogDescription>
          </DialogHeader>
          {editingPlan && (
            <PlanForm
              plan={editingPlan}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingPlan(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPlan} onOpenChange={() => setDeletingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>プランを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deletingPlan?.name}」を削除します。この操作はプランを無効化します。
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
