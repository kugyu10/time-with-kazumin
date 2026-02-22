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
import type { Member } from "@/lib/actions/admin/members"

type ColumnsProps = {
  onAdjustPoints: (member: Member) => void
  onDeactivate: (member: Member) => void
}

export function getColumns({ onAdjustPoints, onDeactivate }: ColumnsProps): ColumnDef<Member>[] {
  return [
    {
      accessorKey: "full_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          名前
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => row.original.full_name ?? "-",
    },
    {
      accessorKey: "email",
      header: "メール",
    },
    {
      accessorKey: "member_plan.plan.name",
      header: "プラン",
      cell: ({ row }) => row.original.member_plan?.plan.name ?? "-",
    },
    {
      accessorKey: "member_plan.current_points",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          ポイント残高
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const points = row.original.member_plan?.current_points
        return points !== undefined ? `${points} pt` : "-"
      },
    },
    {
      accessorKey: "member_plan.status",
      header: "ステータス",
      cell: ({ row }) => {
        const status = row.original.member_plan?.status
        if (!status) return "-"

        const statusConfig = {
          active: { label: "有効", variant: "default" as const },
          suspended: { label: "停止中", variant: "secondary" as const },
          canceled: { label: "退会済み", variant: "destructive" as const },
        }

        const config = statusConfig[status]
        return <Badge variant={config.variant}>{config.label}</Badge>
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const member = row.original
        const isActive = member.member_plan?.status === "active"

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
              <DropdownMenuItem
                onClick={() => onAdjustPoints(member)}
                disabled={!isActive}
              >
                ポイント調整
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDeactivate(member)}
                disabled={!isActive}
                className="text-destructive"
              >
                退会処理
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
