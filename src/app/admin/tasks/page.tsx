import { getTaskLogs } from "@/lib/actions/admin/tasks"
import { TasksClient } from "./tasks-client"

export default async function TasksPage() {
  const logs = await getTaskLogs()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">タスク実行履歴</h1>
          <p className="text-muted-foreground mt-2">
            自動化タスクの実行履歴を確認できます
          </p>
        </div>
      </div>

      <TasksClient initialLogs={logs} />
    </div>
  )
}
