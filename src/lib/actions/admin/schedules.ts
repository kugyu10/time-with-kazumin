"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"

// Validation schema for a single schedule entry
const ScheduleEntrySchema = z.object({
  day_of_week: z.number().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式で入力してください"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式で入力してください"),
  is_available: z.boolean(),
  break_start_time: z.string().optional(),
  break_end_time: z.string().optional(),
})

// Full schedule for a pattern (7 days)
const SchedulesSchema = z.array(ScheduleEntrySchema).length(7)

export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>

export type Schedule = {
  id: number
  day_of_week: number
  is_holiday_pattern: boolean
  start_time: string
  end_time: string
  break_start_time: string | null
  break_end_time: string | null
  created_at: string
  updated_at: string
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
 * Get schedules for a specific pattern (weekday or holiday)
 */
export async function getSchedules(isHolidayPattern: boolean): Promise<Schedule[]> {
  await requireAdmin()

  const supabase = getSupabaseServiceRole()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: schedules, error } = await (supabase as any)
    .from("weekly_schedules")
    .select("*")
    .eq("is_holiday_pattern", isHolidayPattern)
    .order("day_of_week", { ascending: true }) as {
      data: Schedule[] | null
      error: { message: string } | null
    }

  if (error) {
    throw new Error(`スケジュールの取得に失敗しました: ${error.message}`)
  }

  return schedules ?? []
}

/**
 * Update schedules for a specific pattern
 * Uses UPSERT to insert or update based on day_of_week + is_holiday_pattern
 */
export async function updateSchedules(
  isHolidayPattern: boolean,
  schedules: ScheduleEntry[]
): Promise<{ success: boolean }> {
  await requireAdmin()

  const validated = SchedulesSchema.parse(schedules)
  const supabase = getSupabaseServiceRole()

  // Prepare data for upsert
  const upsertData = validated.map((entry) => ({
    day_of_week: entry.day_of_week,
    is_holiday_pattern: isHolidayPattern,
    start_time: entry.is_available ? entry.start_time : "00:00",
    end_time: entry.is_available ? entry.end_time : "00:00",
    break_start_time: entry.is_available && entry.break_start_time ? entry.break_start_time : null,
    break_end_time: entry.is_available && entry.break_end_time ? entry.break_end_time : null,
  }))

  // Delete existing schedules for this pattern and insert new ones
  // This is simpler than UPSERT since we always have 7 entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("weekly_schedules")
    .delete()
    .eq("is_holiday_pattern", isHolidayPattern) as { error: { message: string } | null }

  if (deleteError) {
    throw new Error(`スケジュールの削除に失敗しました: ${deleteError.message}`)
  }

  // Only insert schedules where is_available is true
  const availableSchedules = upsertData.filter((_, index) => validated[index].is_available)

  if (availableSchedules.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("weekly_schedules")
      .insert(availableSchedules) as { error: { message: string } | null }

    if (insertError) {
      throw new Error(`スケジュールの作成に失敗しました: ${insertError.message}`)
    }
  }

  revalidatePath("/admin/schedules")
  return { success: true }
}
