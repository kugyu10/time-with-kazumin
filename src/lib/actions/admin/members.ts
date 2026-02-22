"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"

// Validation schema for member creation
const CreateMemberSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  full_name: z.string().min(1, "名前は必須です").max(100, "名前は100文字以内で入力してください"),
  plan_id: z.number().min(1, "プランを選択してください"),
})

type CreateMemberInput = z.infer<typeof CreateMemberSchema>

export type Member = {
  id: string
  email: string
  full_name: string | null
  role: "guest" | "member" | "admin"
  created_at: string
  member_plan?: {
    id: number
    plan_id: number
    current_points: number
    status: "active" | "suspended" | "canceled"
    plan: {
      name: string
    }
  } | null
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
 * Get all members with their plans
 */
export async function getMembers(): Promise<Member[]> {
  await requireAdmin()

  const supabase = getSupabaseServiceRole()

  // Get profiles with role='member' and join member_plans
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles, error } = await (supabase as any)
    .from("profiles")
    .select(`
      id,
      email,
      full_name,
      role,
      created_at,
      member_plans (
        id,
        plan_id,
        current_points,
        status,
        plans (
          name
        )
      )
    `)
    .eq("role", "member")
    .order("created_at", { ascending: false }) as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: any[] | null
      error: { message: string } | null
    }

  if (error) {
    throw new Error(`会員の取得に失敗しました: ${error.message}`)
  }

  // Transform data to match Member type
  return (profiles ?? []).map((profile) => {
    const memberPlan = profile.member_plans?.[0]
    return {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      created_at: profile.created_at,
      member_plan: memberPlan ? {
        id: memberPlan.id,
        plan_id: memberPlan.plan_id,
        current_points: memberPlan.current_points,
        status: memberPlan.status,
        plan: {
          name: memberPlan.plans?.name ?? "不明",
        },
      } : null,
    }
  })
}

/**
 * Create a new member
 */
export async function createMember(data: CreateMemberInput) {
  await requireAdmin()

  const validated = CreateMemberSchema.parse(data)
  const supabase = getSupabaseServiceRole()

  // Generate random password (user will reset via email)
  const tempPassword = crypto.randomUUID().slice(0, 16)

  // Create user in Supabase Auth
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: validated.email,
    password: tempPassword,
    email_confirm: true, // Mark email as confirmed
  })

  if (authError) {
    throw new Error(`ユーザーの作成に失敗しました: ${authError.message}`)
  }

  if (!authUser.user) {
    throw new Error("ユーザーの作成に失敗しました")
  }

  // Create profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (supabase as any)
    .from("profiles")
    .insert({
      id: authUser.user.id,
      email: validated.email,
      full_name: validated.full_name,
      role: "member",
    }) as { error: { message: string } | null }

  if (profileError) {
    // Rollback: delete auth user
    await supabase.auth.admin.deleteUser(authUser.user.id)
    throw new Error(`プロフィールの作成に失敗しました: ${profileError.message}`)
  }

  // Get plan details for monthly_points
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan, error: planError } = await (supabase as any)
    .from("plans")
    .select("monthly_points")
    .eq("id", validated.plan_id)
    .single() as { data: { monthly_points: number } | null; error: { message: string } | null }

  if (planError || !plan) {
    // Rollback
    await supabase.auth.admin.deleteUser(authUser.user.id)
    throw new Error(`プランの取得に失敗しました`)
  }

  // Create member_plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: memberPlanError } = await (supabase as any)
    .from("member_plans")
    .insert({
      user_id: authUser.user.id,
      plan_id: validated.plan_id,
      current_points: plan.monthly_points, // Initial points = monthly points
      monthly_points: plan.monthly_points,
      status: "active",
    }) as { error: { message: string } | null }

  if (memberPlanError) {
    // Rollback
    await supabase.auth.admin.deleteUser(authUser.user.id)
    throw new Error(`会員プランの作成に失敗しました: ${memberPlanError.message}`)
  }

  // Send password reset email so user can set their own password
  await supabase.auth.admin.generateLink({
    type: "recovery",
    email: validated.email,
  })

  revalidatePath("/admin/members")
  return { success: true, userId: authUser.user.id }
}

/**
 * Deactivate a member (soft delete)
 */
export async function deactivateMember(userId: string) {
  await requireAdmin()

  const supabase = getSupabaseServiceRole()

  // Update member_plan status to canceled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: memberPlanError } = await (supabase as any)
    .from("member_plans")
    .update({
      status: "canceled",
      ended_at: new Date().toISOString(),
    })
    .eq("user_id", userId) as { error: { message: string } | null }

  if (memberPlanError) {
    throw new Error(`会員プランの更新に失敗しました: ${memberPlanError.message}`)
  }

  // Update profile role to 'guest' (they can no longer access member features)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (supabase as any)
    .from("profiles")
    .update({
      role: "guest",
    })
    .eq("id", userId) as { error: { message: string } | null }

  if (profileError) {
    throw new Error(`プロフィールの更新に失敗しました: ${profileError.message}`)
  }

  revalidatePath("/admin/members")
  return { success: true }
}
