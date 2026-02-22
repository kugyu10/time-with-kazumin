"use client"

import { useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { columns } from "./columns"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TaskLog, TaskName, TaskStatus } from "@/lib/actions/admin/tasks"

type TasksClientProps = {
  initialLogs: TaskLog[]
}

const taskNameOptions: { value: TaskName | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "monthly_point_grant", label: "月次ポイント付与" },
  { value: "reminder_email", label: "リマインダーメール" },
  { value: "thank_you_email", label: "サンキューメール" },
]

const statusOptions: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "success", label: "成功" },
  { value: "partial_success", label: "部分成功" },
  { value: "failed", label: "失敗" },
]

export function TasksClient({ initialLogs }: TasksClientProps) {
  const [logs] = useState<TaskLog[]>(initialLogs)
  const [taskNameFilter, setTaskNameFilter] = useState<TaskName | "all">("all")
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all")

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (taskNameFilter !== "all" && log.task_name !== taskNameFilter) {
      return false
    }
    if (statusFilter !== "all" && log.status !== statusFilter) {
      return false
    }
    return true
  })

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">タスク:</span>
          <Select
            value={taskNameFilter}
            onValueChange={(value) => setTaskNameFilter(value as TaskName | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="フィルタ" />
            </SelectTrigger>
            <SelectContent>
              {taskNameOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">ステータス:</span>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as TaskStatus | "all")}
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
          {filteredLogs.length}件のログ
        </div>
      </div>

      <DataTable columns={columns} data={filteredLogs} pageSize={20} />
    </>
  )
}
