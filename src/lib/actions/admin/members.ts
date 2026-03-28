"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"
import { sendWelcomeEmail } from "@/lib/integrations/email"

// Validation schema for member creation
const CreateMemberSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  full_name: z.string().min(1, "名前は必須です").max(100, "名前は100文字以内で入力してください"),
  plan_id: z.number().min(1, "プランを選択してください"),
})

type CreateMemberInput = z.infer<typeof CreateMemberSchema>

export type ActivityStatus = 'normal' | 'yellow' | 'red'

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
  last_session_at: string | null
  has_future_booking: boolean
  activity_status: ActivityStatus
}

/**
 * Calculate activity status based on last session date and future booking
 */
export function calcActivityStatus(
  lastSessionAt: string | null,
  hasFutureBooking: boolean
): ActivityStatus {
  if (hasFutureBooking) return 'normal'
  if (lastSessionAt === null) return 'red'
  const daysAgo = Math.floor(
    (Date.now() - new Date(lastSessionAt).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysAgo >= 60) return 'red'
  if (daysAgo >= 30) return 'yellow'
  return 'normal'
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
 * Get all members with their plans and activity status
 */
export async function getMembers(): Promise<Member[]> {
  await requireAdmin()

  const supabase = getSupabaseServiceRole()

  // Step 1: Get profiles with role='member' and join member_plans
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

  // Step 2: Collect member_plan_ids for bookings queries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberPlanIds = (profiles ?? []).map((p: any) => p.member_plans?.[0]?.id).filter(Boolean) as number[]

  // Step 2a: Get last completed session per member_plan
  const { data: lastSessions } = memberPlanIds.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (supabase as any)
        .from("bookings")
        .select("member_plan_id, end_time")
        .in("member_plan_id", memberPlanIds)
        .eq("status", "completed")
        .order("end_time", { ascending: false })
    : { data: [] }

  // Step 2b: Get future confirmed bookings per member_plan
  const now = new Date().toISOString()
  const { data: futureBookings } = memberPlanIds.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (supabase as any)
        .from("bookings")
        .select("member_plan_id")
        .in("member_plan_id", memberPlanIds)
        .eq("status", "confirmed")
        .gt("start_time", now)
    : { data: [] }

  // Aggregate into Maps/Sets
  const lastSessionMap = new Map<number, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (lastSessions ?? []) as any[]) {
    if (!lastSessionMap.has(row.member_plan_id)) {
      lastSessionMap.set(row.member_plan_id, row.end_time)
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasFutureBookingSet = new Set((futureBookings ?? []).map((r: any) => r.member_plan_id))

  // Transform data to match Member type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (profiles ?? []).map((profile: any) => {
    const memberPlan = profile.member_plans?.[0]
    const memberPlanId = memberPlan?.id as number | undefined
    const lastSessionAt = memberPlanId != null ? (lastSessionMap.get(memberPlanId) ?? null) : null
    const hasFutureBooking = memberPlanId != null ? hasFutureBookingSet.has(memberPlanId) : false
    // active会員のみactivity_statusを計算、それ以外はnormal
    const activity_status = memberPlan?.status === 'active'
      ? calcActivityStatus(lastSessionAt, hasFutureBooking)
      : 'normal' as ActivityStatus

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
      last_session_at: lastSessionAt,
      has_future_booking: hasFutureBooking,
      activity_status,
    }
  })
}

/**
 * Get members that need follow-up (yellow or red activity status)
 */
export async function getFollowUpMembers(): Promise<Member[]> {
  await requireAdmin()
  const all = await getMembers()
  return all.filter(m =>
    m.member_plan?.status === 'active' &&
    (m.activity_status === 'yellow' || m.activity_status === 'red')
  )
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

  let userId: string
  let isNewAuthUser = false // Track if we created the auth user (for rollback)

  // Create user in Supabase Auth
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: validated.email,
    password: tempPassword,
    email_confirm: true, // Mark email as confirmed
  })

  if (authError) {
    // Check if user already exists in auth (e.g., from failed Google login attempt)
    if (authError.message.includes("already been registered")) {
      // Find existing auth user by email
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      const existingAuthUser = existingUsers?.users?.find(u => u.email === validated.email)

      if (!existingAuthUser) {
        throw new Error(`ユーザーの作成に失敗しました: ${authError.message}`)
      }

      // Check if profile already exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingProfile } = await (supabase as any)
        .from("profiles")
        .select("id")
        .eq("id", existingAuthUser.id)
        .single() as { data: { id: string } | null }

      if (existingProfile) {
        throw new Error("このメールアドレスは既に会員として登録されています")
      }

      // Use existing auth user's ID (don't delete on rollback)
      userId = existingAuthUser.id
      isNewAuthUser = false
    } else {
      throw new Error(`ユーザーの作成に失敗しました: ${authError.message}`)
    }
  } else if (!authUser.user) {
    throw new Error("ユーザーの作成に失敗しました")
  } else {
    userId = authUser.user.id
    isNewAuthUser = true
  }

  // Create profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (supabase as any)
    .from("profiles")
    .insert({
      id: userId,
      email: validated.email,
      full_name: validated.full_name,
      role: "member",
    }) as { error: { message: string } | null }

  if (profileError) {
    // Rollback: only delete auth user if we created it
    if (isNewAuthUser) {
      await supabase.auth.admin.deleteUser(userId)
    }
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
    // Rollback: delete profile, and auth user if we created it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("profiles").delete().eq("id", userId)
    if (isNewAuthUser) {
      await supabase.auth.admin.deleteUser(userId)
    }
    throw new Error(`プランの取得に失敗しました`)
  }

  // Create member_plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: memberPlanError } = await (supabase as any)
    .from("member_plans")
    .insert({
      user_id: userId,
      plan_id: validated.plan_id,
      current_points: plan.monthly_points, // Initial points = monthly points
      monthly_points: plan.monthly_points,
      status: "active",
    }) as { error: { message: string } | null }

  if (memberPlanError) {
    // Rollback: delete profile, and auth user if we created it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("profiles").delete().eq("id", userId)
    if (isNewAuthUser) {
      await supabase.auth.admin.deleteUser(userId)
    }
    throw new Error(`会員プランの作成に失敗しました: ${memberPlanError.message}`)
  }

  // Send password reset email so user can set their own password
  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: validated.email,
  })

  const resetUrl = linkData?.properties?.action_link ?? null

  // 非ブロッキング: 失敗しても会員作成は成功扱い
  try {
    await sendWelcomeEmail({
      userEmail: validated.email,
      userName: validated.full_name,
      passwordResetUrl: resetUrl,
    })
  } catch (error) {
    console.warn("[createMember] Welcome email failed (non-blocking):", error)
  }

  revalidatePath("/admin/members")
  return { success: true, userId }
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
