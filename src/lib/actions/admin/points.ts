"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"

// Validation schema for point adjustment
const AdjustPointsSchema = z.object({
  memberPlanId: z.number().min(1),
  amount: z.number().refine((val) => val !== 0, "0以外の値を入力してください"),
  notes: z.string().min(1, "理由は必須です").max(500, "理由は500文字以内で入力してください"),
})

type AdjustPointsInput = z.infer<typeof AdjustPointsSchema>

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
 * Adjust member points (add or subtract)
 * Uses manual_adjust_points RPC for atomic operation
 */
export async function adjustPoints(data: AdjustPointsInput) {
  await requireAdmin()

  const validated = AdjustPointsSchema.parse(data)
  const supabase = getSupabaseServiceRole()

  // Call manual_adjust_points RPC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newBalance, error } = await (supabase as any).rpc("manual_adjust_points", {
    p_member_plan_id: validated.memberPlanId,
    p_points: validated.amount,
    p_notes: validated.notes,
  }) as { data: number | null; error: { message: string } | null }

  if (error) {
    // Handle specific error messages
    if (error.message.includes("Cannot reduce points below zero")) {
      throw new Error("ポイント残高が不足しています。減算後の残高がマイナスになります。")
    }
    if (error.message.includes("Member plan not found")) {
      throw new Error("会員プランが見つかりません。")
    }
    throw new Error(`ポイント調整に失敗しました: ${error.message}`)
  }

  revalidatePath("/admin/members")
  return { success: true, newBalance }
}
