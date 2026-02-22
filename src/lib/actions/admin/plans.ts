"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"

// Validation schema
const PlanSchema = z.object({
  name: z.string().min(1, "プラン名は必須です").max(100, "プラン名は100文字以内で入力してください"),
  monthly_points: z.number().min(0, "0以上で設定してください"),
  price_yen: z.number().min(0, "0以上で設定してください"),
  description: z.string().optional().nullable(),
  is_active: z.boolean(),
})

type PlanInput = z.infer<typeof PlanSchema>

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
 * Create a new plan
 */
export async function createPlan(data: PlanInput) {
  await requireAdmin()

  const validated = PlanSchema.parse(data)
  const supabase = getSupabaseServiceRole()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan, error } = await (supabase as any)
    .from("plans")
    .insert({
      name: validated.name,
      monthly_points: validated.monthly_points,
      price_monthly: validated.price_yen,
      is_active: validated.is_active,
    })
    .select()
    .single() as { data: { id: number } | null; error: { message: string } | null }

  if (error) {
    throw new Error(`プランの作成に失敗しました: ${error.message}`)
  }

  revalidatePath("/admin/plans")
  return { success: true, plan }
}

/**
 * Update an existing plan
 */
export async function updatePlan(id: number, data: PlanInput) {
  await requireAdmin()

  const validated = PlanSchema.parse(data)
  const supabase = getSupabaseServiceRole()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan, error } = await (supabase as any)
    .from("plans")
    .update({
      name: validated.name,
      monthly_points: validated.monthly_points,
      price_monthly: validated.price_yen,
      is_active: validated.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single() as { data: { id: number } | null; error: { message: string } | null }

  if (error) {
    throw new Error(`プランの更新に失敗しました: ${error.message}`)
  }

  revalidatePath("/admin/plans")
  return { success: true, plan }
}

/**
 * Delete a plan (soft delete by setting is_active = false)
 */
export async function deletePlan(id: number) {
  await requireAdmin()

  const supabase = getSupabaseServiceRole()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("plans")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id) as { error: { message: string } | null }

  if (error) {
    throw new Error(`プランの削除に失敗しました: ${error.message}`)
  }

  revalidatePath("/admin/plans")
  return { success: true }
}

/**
 * Get all plans (for admin)
 */
export async function getPlans() {
  await requireAdmin()

  const supabase = getSupabaseServiceRole()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plans, error } = await (supabase as any)
    .from("plans")
    .select("*")
    .order("created_at", { ascending: false }) as {
      data: Array<{
        id: number
        name: string
        monthly_points: number
        max_points: number | null
        price_monthly: number | null
        is_active: boolean
        created_at: string
        updated_at: string
      }> | null
      error: { message: string } | null
    }

  if (error) {
    throw new Error(`プランの取得に失敗しました: ${error.message}`)
  }

  return plans ?? []
}
