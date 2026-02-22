"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
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
import { adjustPoints } from "@/lib/actions/admin/points"
import type { Member } from "@/lib/actions/admin/members"

const formSchema = z.object({
  amount: z
    .number()
    .refine((val) => val !== 0, "0以外の値を入力してください"),
  notes: z
    .string()
    .min(1, "理由は必須です")
    .max(500, "理由は500文字以内で入力してください"),
})

type FormValues = z.infer<typeof formSchema>

type PointAdjustFormProps = {
  member: Member
  onSuccess?: () => void
  onCancel?: () => void
}

export function PointAdjustForm({ member, onSuccess, onCancel }: PointAdjustFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null)

  const currentPoints = member.member_plan?.current_points ?? 0
  const memberPlanId = member.member_plan?.id

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      notes: "",
    },
  })

  const watchedAmount = form.watch("amount")
  const newBalance = currentPoints + (watchedAmount || 0)

  function handleSubmit(values: FormValues) {
    setPendingValues(values)
    setShowConfirm(true)
  }

  function confirmAdjust() {
    if (!pendingValues || !memberPlanId) return

    setError(null)
    setShowConfirm(false)

    startTransition(async () => {
      try {
        await adjustPoints({
          memberPlanId,
          amount: pendingValues.amount,
          notes: pendingValues.notes,
        })
        onSuccess?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました")
      }
    })
  }

  if (!memberPlanId) {
    return (
      <div className="text-sm text-destructive">
        この会員にはプランが設定されていません
      </div>
    )
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Member info (read-only) */}
          <div className="rounded-md border p-4 bg-muted/50 space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">会員名: </span>
              <span className="font-medium">{member.full_name ?? "-"}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">メール: </span>
              <span>{member.email}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">現在のポイント: </span>
              <span className="font-medium">{currentPoints} pt</span>
            </div>
          </div>

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>調整ポイント数</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="例: 100 (付与) または -50 (減算)"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormDescription>
                  正の値で付与、負の値で減算されます
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Preview new balance */}
          {watchedAmount !== 0 && (
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="text-sm">
                <span className="text-muted-foreground">調整後の残高: </span>
                <span className={`font-medium ${newBalance < 0 ? "text-destructive" : ""}`}>
                  {newBalance} pt
                </span>
              </div>
              {newBalance < 0 && (
                <div className="text-sm text-destructive mt-1">
                  残高がマイナスになるため調整できません
                </div>
              )}
            </div>
          )}

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>理由（必須）</FormLabel>
                <FormControl>
                  <Input
                    placeholder="例: キャンペーン特典付与、システムエラーによる補填"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  監査証跡として記録されます
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                キャンセル
              </Button>
            )}
            <Button
              type="submit"
              disabled={isPending || newBalance < 0}
            >
              {isPending ? "処理中..." : "調整を実行"}
            </Button>
          </div>
        </form>
      </Form>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ポイント調整の確認</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>以下の内容でポイントを調整します。</div>
              <div className="rounded-md border p-3 bg-muted/30 space-y-1 text-foreground">
                <div>会員: {member.full_name}</div>
                <div>
                  調整: {pendingValues?.amount ?? 0 > 0 ? "+" : ""}
                  {pendingValues?.amount} pt
                </div>
                <div>調整後残高: {newBalance} pt</div>
                <div>理由: {pendingValues?.notes}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAdjust}>
              実行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
