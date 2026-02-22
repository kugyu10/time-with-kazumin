"use client"

import { useOptimistic, useTransition } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateBookingStatus, type BookingStatus } from "@/lib/actions/admin/bookings"

type BookingStatusSelectProps = {
  bookingId: number
  currentStatus: BookingStatus
  disabled?: boolean
  onSuccess?: () => void
  onError?: (error: string) => void
}

const statusLabels: Record<BookingStatus, string> = {
  pending: "確認待ち",
  confirmed: "確定",
  canceled: "キャンセル",
  completed: "完了",
}

export function BookingStatusSelect({
  bookingId,
  currentStatus,
  disabled = false,
  onSuccess,
  onError,
}: BookingStatusSelectProps) {
  const [isPending, startTransition] = useTransition()
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(currentStatus)

  const handleStatusChange = (newStatus: BookingStatus) => {
    if (newStatus === currentStatus) return

    startTransition(async () => {
      // 楽観的更新
      setOptimisticStatus(newStatus)

      try {
        await updateBookingStatus(bookingId, newStatus)
        onSuccess?.()
      } catch (error) {
        // エラー時は元に戻す（revalidatePathで自動反映）
        onError?.(error instanceof Error ? error.message : "更新に失敗しました")
      }
    })
  }

  const isDisabled = disabled || isPending || currentStatus === "canceled"

  return (
    <Select
      value={optimisticStatus}
      onValueChange={(value) => handleStatusChange(value as BookingStatus)}
      disabled={isDisabled}
    >
      <SelectTrigger className="w-[130px]">
        <SelectValue placeholder="ステータス" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">{statusLabels.pending}</SelectItem>
        <SelectItem value="confirmed">{statusLabels.confirmed}</SelectItem>
        <SelectItem value="completed">{statusLabels.completed}</SelectItem>
        <SelectItem value="canceled" disabled>
          {statusLabels.canceled}
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
