"use client"

import { useState, useTransition } from "react"
import { DataTable } from "@/components/ui/data-table"
import { getColumns } from "./columns"
import { BookingCancelDialog } from "@/components/admin/booking-cancel-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  updateBookingStatus,
  type AdminBooking,
  type BookingStatus,
} from "@/lib/actions/admin/bookings"

type BookingsClientProps = {
  initialBookings: AdminBooking[]
}

const statusOptions: { value: BookingStatus | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "pending", label: "確認待ち" },
  { value: "confirmed", label: "確定" },
  { value: "completed", label: "完了" },
  { value: "canceled", label: "キャンセル" },
]

export function BookingsClient({ initialBookings }: BookingsClientProps) {
  const [bookings, setBookings] = useState<AdminBooking[]>(initialBookings)
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all")
  const [cancellingBooking, setCancellingBooking] = useState<AdminBooking | null>(null)
  const [, startTransition] = useTransition()

  const handleStatusChange = (bookingId: number, newStatus: BookingStatus) => {
    // 楽観的更新
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, status: newStatus } : b
      )
    )

    startTransition(async () => {
      try {
        await updateBookingStatus(bookingId, newStatus)
      } catch (error) {
        console.error("Status update failed:", error)
        // エラー時はリロードで元に戻す
        window.location.reload()
      }
    })
  }

  const handleCancel = (booking: AdminBooking) => {
    setCancellingBooking(booking)
  }

  const handleCancelSuccess = (refundedPoints?: number) => {
    // キャンセル成功時のUI更新
    if (cancellingBooking) {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === cancellingBooking.id ? { ...b, status: "canceled" as BookingStatus } : b
        )
      )
    }
    setCancellingBooking(null)

    if (refundedPoints && refundedPoints > 0) {
      // ポイント返還があった場合のフィードバック（将来的にはtoast等で通知）
      console.log(`ポイント返還: ${refundedPoints}pt`)
    }
  }

  const columns = getColumns({
    onStatusChange: handleStatusChange,
    onCancel: handleCancel,
  })

  // Filter bookings
  const filteredBookings = statusFilter === "all"
    ? bookings
    : bookings.filter((b) => b.status === statusFilter)

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">ステータス:</span>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as BookingStatus | "all")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="フィルタ" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground">
          {filteredBookings.length}件の予約
        </div>
      </div>

      <DataTable columns={columns} data={filteredBookings} pageSize={20} />

      <BookingCancelDialog
        booking={cancellingBooking}
        open={!!cancellingBooking}
        onOpenChange={() => setCancellingBooking(null)}
        onSuccess={handleCancelSuccess}
      />
    </>
  )
}
