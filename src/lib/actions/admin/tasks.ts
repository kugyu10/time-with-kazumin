"use server"

import { createClient } from "@/lib/supabase/server"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"

// Types
export type TaskStatus = "success" | "partial_success" | "failed"
export type TaskName = "monthly_point_grant" | "reminder_email" | "thank_you_email"

export type TaskLog = {
  id: number
  task_name: TaskName
  status: TaskStatus
  started_at: string
  completed_at: string | null
  total_count: number
  success_count: number
  failed_count: number
  reference_type: string | null
  reference_id: string | null
  details: Record<string, unknown> | null
  error_details: Record<string, unknown> | null
}

export type GetTaskLogsFilters = {
  task_name?: TaskName
  status?: TaskStatus
  date_from?: string
  date_to?: string
}

/**
 * Check if the current user is admin
 */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("認証が必要です")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as { data: { role: string } | null; error: unknown }

  if (error || !profile || profile.role !== "admin") {
    throw new Error("管理者権限が必要です")
  }

  return user
}

/**
 * Get task execution logs
 */
export async function getTaskLogs(filters?: GetTaskLogsFilters): Promise<TaskLog[]> {
  await requireAdmin()

  const supabase = getSupabaseServiceRole()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("task_execution_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(100)

  // Apply filters
  if (filters?.task_name) {
    query = query.eq("task_name", filters.task_name)
  }
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  if (filters?.date_from) {
    query = query.gte("started_at", filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte("started_at", filters.date_to)
  }

  const { data, error } = await query as { data: TaskLog[] | null; error: { message: string } | null }

  if (error) {
    throw new Error(`タスクログの取得に失敗しました: ${error.message}`)
  }

  return data ?? []
}
