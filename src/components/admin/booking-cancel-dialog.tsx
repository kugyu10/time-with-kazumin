"use client"

import { useState, useTransition } from "react"
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
import { Badge } from "@/components/ui/badge"
import { cancelBookingByAdmin, type AdminBooking } from "@/lib/actions/admin/bookings"
import { format } from "date-fns"
import { ja } from "date-fns/locale"

type BookingCancelDialogProps = {
  booking: AdminBooking | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (refundedPoints?: number) => void
  onError?: (error: string) => void
}

export function BookingCancelDialog({
  booking,
  open,
  onOpenChange,
  onSuccess,
  onError,
}: BookingCancelDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleCancel = () => {
    if (!booking) return

    setError(null)
    startTransition(async () => {
      try {
        const result = await cancelBookingByAdmin(booking.id)
        onOpenChange(false)
        onSuccess?.(result.refunded_points)
      } catch (err) {
        const message = err instanceof Error ? err.message : "キャンセルに失敗しました"
        setError(message)
        onError?.(message)
      }
    })
  }

  if (!booking) return null

  const startTime = new Date(booking.start_time)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>予約をキャンセルしますか？</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>以下の予約をキャンセルします。この操作は取り消せません。</p>

              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">日時</span>
                  <span className="font-medium">
                    {format(startTime, "yyyy/MM/dd (E) HH:mm", { locale: ja })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ユーザー</span>
                  <span className="font-medium">
                    {booking.user_name ?? "不明"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">メール</span>
                  <span className="font-medium">
                    {booking.user_email ?? "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">メニュー</span>
                  <span className="font-medium">{booking.menu_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">タイプ</span>
                  <Badge variant={booking.is_guest ? "outline" : "secondary"}>
                    {booking.is_guest ? "ゲスト" : "会員"}
                  </Badge>
                </div>
              </div>

              {!booking.is_guest && (
                <p className="text-sm text-muted-foreground">
                  * 会員予約のため、消費ポイントが返還されます
                </p>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "処理中..." : "キャンセルを実行"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
