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
import { getColumns } from "./columns"
import { MemberForm } from "@/components/admin/forms/member-form"
import { PointAdjustForm } from "@/components/admin/forms/point-adjust-form"
import { deactivateMember, type Member } from "@/lib/actions/admin/members"

type Plan = {
  id: number
  name: string
  monthly_points: number
}

type MembersClientProps = {
  initialMembers: Member[]
  plans: Plan[]
}

export function MembersClient({ initialMembers, plans }: MembersClientProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [adjustingMember, setAdjustingMember] = useState<Member | null>(null)
  const [deactivatingMember, setDeactivatingMember] = useState<Member | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAdjustPoints = (member: Member) => {
    setAdjustingMember(member)
  }

  const handleDeactivate = (member: Member) => {
    setDeactivatingMember(member)
  }

  const confirmDeactivate = () => {
    if (!deactivatingMember) return

    startTransition(async () => {
      try {
        await deactivateMember(deactivatingMember.id)
        // Update local state
        setMembers((prev) =>
          prev.map((m) =>
            m.id === deactivatingMember.id
              ? {
                  ...m,
                  role: "guest" as const,
                  member_plan: m.member_plan
                    ? { ...m.member_plan, status: "canceled" as const }
                    : null,
                }
              : m
          )
        )
        setDeactivatingMember(null)
      } catch (error) {
        console.error("Deactivate failed:", error)
      }
    })
  }

  const handleCreateSuccess = () => {
    setIsCreateOpen(false)
    window.location.reload()
  }

  const handleAdjustSuccess = () => {
    setAdjustingMember(null)
    window.location.reload()
  }

  const columns = getColumns({
    onAdjustPoints: handleAdjustPoints,
    onDeactivate: handleDeactivate,
  })

  // Plans are already filtered in the server component
  const activePlans = plans

  return (
    <>
      <div className="flex justify-end">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              会員を登録
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>会員登録</DialogTitle>
              <DialogDescription>
                新しい会員を登録します。登録後、パスワード設定用のメールが送信されます。
              </DialogDescription>
            </DialogHeader>
            <MemberForm
              plans={activePlans}
              onSuccess={handleCreateSuccess}
              onCancel={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <DataTable columns={columns} data={members} />

      {/* Point Adjustment Dialog */}
      <Dialog open={!!adjustingMember} onOpenChange={() => setAdjustingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ポイント調整</DialogTitle>
            <DialogDescription>
              会員のポイントを手動で調整します
            </DialogDescription>
          </DialogHeader>
          {adjustingMember && (
            <PointAdjustForm
              member={adjustingMember}
              onSuccess={handleAdjustSuccess}
              onCancel={() => setAdjustingMember(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <AlertDialog open={!!deactivatingMember} onOpenChange={() => setDeactivatingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>会員を退会させますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deactivatingMember?.full_name ?? deactivatingMember?.email}」を退会処理します。
              この操作により、会員はサービスにアクセスできなくなります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeactivate}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "処理中..." : "退会処理を実行"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
