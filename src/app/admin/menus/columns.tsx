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

export type Menu = {
  id: number
  name: string
  duration_minutes: number
  points_required: number
  zoom_account: "A" | "B"
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type ColumnsProps = {
  onEdit: (menu: Menu) => void
  onDelete: (menu: Menu) => void
}

export function getColumns({ onEdit, onDelete }: ColumnsProps): ColumnDef<Menu>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            メニュー名
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
    },
    {
      accessorKey: "duration_minutes",
      header: "時間（分）",
      cell: ({ row }) => {
        const minutes = row.getValue("duration_minutes") as number
        return <span>{minutes}分</span>
      },
    },
    {
      accessorKey: "points_required",
      header: "必要ポイント",
      cell: ({ row }) => {
        const points = row.getValue("points_required") as number
        return <span>{points}pt</span>
      },
    },
    {
      accessorKey: "zoom_account",
      header: "Zoom",
      cell: ({ row }) => {
        const account = row.getValue("zoom_account") as string
        return <Badge variant="outline">アカウント{account}</Badge>
      },
    },
    {
      accessorKey: "is_active",
      header: "ステータス",
      cell: ({ row }) => {
        const isActive = row.getValue("is_active") as boolean
        return (
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "有効" : "無効"}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const menu = row.original

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
              <DropdownMenuItem onClick={() => onEdit(menu)}>
                編集
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(menu)}
                className="text-destructive"
              >
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
