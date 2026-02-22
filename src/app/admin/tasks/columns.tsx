"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import type { TaskLog, TaskStatus, TaskName } from "@/lib/actions/admin/tasks"

const taskNameLabels: Record<TaskName, string> = {
  monthly_point_grant: "月次ポイント付与",
  reminder_email: "リマインダーメール",
  thank_you_email: "サンキューメール",
}

const statusLabels: Record<TaskStatus, string> = {
  success: "成功",
  partial_success: "部分成功",
  failed: "失敗",
}

const statusVariants: Record<TaskStatus, "default" | "secondary" | "destructive"> = {
  success: "default",
  partial_success: "secondary",
  failed: "destructive",
}

export const columns: ColumnDef<TaskLog>[] = [
  {
    accessorKey: "started_at",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          実行日時
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const startedAt = new Date(row.getValue("started_at"))
      return (
        <div className="space-y-1">
          <div className="font-medium">
            {format(startedAt, "yyyy/MM/dd (E)", { locale: ja })}
          </div>
          <div className="text-sm text-muted-foreground">
            {format(startedAt, "HH:mm:ss")}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "task_name",
    header: "タスク名",
    cell: ({ row }) => {
      const taskName = row.getValue("task_name") as TaskName
      return (
        <div className="font-medium">
          {taskNameLabels[taskName] ?? taskName}
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    header: "ステータス",
    cell: ({ row }) => {
      const status = row.getValue("status") as TaskStatus
      return (
        <Badge variant={statusVariants[status]}>
          {statusLabels[status]}
        </Badge>
      )
    },
  },
  {
    id: "counts",
    header: "実行結果",
    cell: ({ row }) => {
      const log = row.original
      return (
        <div className="space-y-1">
          <div className="text-sm">
            <span className="text-muted-foreground">合計:</span>{" "}
            <span className="font-medium">{log.total_count}</span>
          </div>
          <div className="text-sm">
            <span className="text-green-600">成功:</span>{" "}
            <span className="font-medium">{log.success_count}</span>
            {log.failed_count > 0 && (
              <>
                {" / "}
                <span className="text-red-600">失敗:</span>{" "}
                <span className="font-medium">{log.failed_count}</span>
              </>
            )}
          </div>
        </div>
      )
    },
  },
  {
    id: "reference",
    header: "対象",
    cell: ({ row }) => {
      const log = row.original
      if (!log.reference_type || !log.reference_id) {
        return <span className="text-muted-foreground">-</span>
      }
      return (
        <div className="text-sm">
          <div className="text-muted-foreground">{log.reference_type}</div>
          <div className="font-mono text-xs">{log.reference_id}</div>
        </div>
      )
    },
  },
  {
    id: "error",
    header: "エラー",
    cell: ({ row }) => {
      const log = row.original
      if (!log.error_details) {
        return <span className="text-muted-foreground">-</span>
      }
      return (
        <div className="max-w-xs">
          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
            {JSON.stringify(log.error_details, null, 2)}
          </pre>
        </div>
      )
    },
  },
]
