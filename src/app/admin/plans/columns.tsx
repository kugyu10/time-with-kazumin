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

export type Plan = {
  id: number
  name: string
  monthly_points: number
  max_points: number | null
  price_monthly: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type ColumnsProps = {
  onEdit: (plan: Plan) => void
  onDelete: (plan: Plan) => void
}

export function getColumns({ onEdit, onDelete }: ColumnsProps): ColumnDef<Plan>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            プラン名
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
    },
    {
      accessorKey: "monthly_points",
      header: "月間ポイント",
      cell: ({ row }) => {
        const points = row.getValue("monthly_points") as number
        return <span>{points.toLocaleString()}pt</span>
      },
    },
    {
      accessorKey: "price_monthly",
      header: "月額料金",
      cell: ({ row }) => {
        const price = row.getValue("price_monthly") as number | null
        return <span>{price != null ? `${price.toLocaleString()}円` : "-"}</span>
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
        const plan = row.original

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
              <DropdownMenuItem onClick={() => onEdit(plan)}>
                編集
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(plan)}
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
