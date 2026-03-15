"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import type { AdminBooking, BookingStatus } from "@/lib/actions/admin/bookings"

type ColumnsProps = {
  onStatusChange: (bookingId: number, status: BookingStatus) => void
  onCancel: (booking: AdminBooking) => void
}

const statusLabels: Record<BookingStatus, string> = {
  pending: "確認待ち",
  confirmed: "確定",
  canceled: "キャンセル",
  completed: "完了",
}

const statusVariants: Record<BookingStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  confirmed: "default",
  canceled: "destructive",
  completed: "secondary",
}

export function getColumns({ onStatusChange, onCancel }: ColumnsProps): ColumnDef<AdminBooking>[] {
  return [
    {
      accessorKey: "start_time",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            日時
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const startTime = new Date(row.getValue("start_time"))
        const endTime = new Date(row.original.end_time)
        return (
          <div className="space-y-1">
            <div className="font-medium">
              {startTime.toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                weekday: "short",
                timeZone: "Asia/Tokyo",
              })}
            </div>
            <div className="text-sm text-muted-foreground">
              {startTime.toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "Asia/Tokyo",
              })} - {endTime.toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "Asia/Tokyo",
              })}
            </div>
          </div>
        )
      },
    },
    {
      id: "user",
      header: "ユーザー",
      cell: ({ row }) => {
        const booking = row.original
        return (
          <div className="space-y-1">
            <div className="font-medium">
              {booking.user_name ?? "不明"}
            </div>
            <div className="text-sm text-muted-foreground">
              {booking.user_email ?? "-"}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "menu_name",
      header: "メニュー",
      cell: ({ row }) => {
        return (
          <div className="space-y-1">
            <div>{row.original.menu_name}</div>
            <div className="text-sm text-muted-foreground">
              {row.original.menu_duration}分
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: "ステータス",
      cell: ({ row }) => {
        const status = row.getValue("status") as BookingStatus
        return (
          <Badge variant={statusVariants[status]}>
            {statusLabels[status]}
          </Badge>
        )
      },
    },
    {
      accessorKey: "is_guest",
      header: "タイプ",
      cell: ({ row }) => {
        const isGuest = row.getValue("is_guest") as boolean
        return (
          <Badge variant={isGuest ? "outline" : "secondary"}>
            {isGuest ? "ゲスト" : "会員"}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const booking = row.original
        const canChangeStatus = booking.status !== "canceled" && booking.status !== "completed"

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">メニューを開く</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>アクション</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canChangeStatus && (
                <>
                  {booking.status !== "confirmed" && (
                    <DropdownMenuItem onClick={() => onStatusChange(booking.id, "confirmed")}>
                      確定に変更
                    </DropdownMenuItem>
                  )}
                  {booking.status !== "completed" && (
                    <DropdownMenuItem onClick={() => onStatusChange(booking.id, "completed")}>
                      完了に変更
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onCancel(booking)}
                    className="text-destructive"
                  >
                    キャンセル
                  </DropdownMenuItem>
                </>
              )}
              {!canChangeStatus && (
                <DropdownMenuItem disabled>
                  変更不可
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
