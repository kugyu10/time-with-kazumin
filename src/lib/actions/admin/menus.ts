"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"

// Validation schema
const MenuSchema = z.object({
  name: z.string().min(1, "メニュー名は必須です").max(100, "メニュー名は100文字以内で入力してください"),
  duration_minutes: z.number().min(15, "15分以上で設定してください").max(480, "8時間以内で設定してください"),
  points_required: z.number().min(0, "0以上で設定してください"),
  zoom_account: z.enum(["A", "B"]),
  description: z.string().optional().nullable(),
  is_active: z.boolean(),
  send_thank_you_email: z.boolean(),
})

type MenuInput = z.infer<typeof MenuSchema>

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
 * Create a new menu
 */
export async function createMenu(data: MenuInput) {
  await requireAdmin()

  const validated = MenuSchema.parse(data)
  const supabase = getSupabaseServiceRole()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: menu, error } = await (supabase as any)
    .from("meeting_menus")
    .insert({
      name: validated.name,
      duration_minutes: validated.duration_minutes,
      points_required: validated.points_required,
      zoom_account: validated.zoom_account,
      description: validated.description ?? null,
      is_active: validated.is_active,
      send_thank_you_email: validated.send_thank_you_email,
    })
    .select()
    .single() as { data: { id: number } | null; error: { message: string } | null }

  if (error) {
    throw new Error(`メニューの作成に失敗しました: ${error.message}`)
  }

  revalidatePath("/admin/menus")
  return { success: true, menu }
}

/**
 * Update an existing menu
 */
export async function updateMenu(id: number, data: MenuInput) {
  await requireAdmin()

  const validated = MenuSchema.parse(data)
  const supabase = getSupabaseServiceRole()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: menu, error } = await (supabase as any)
    .from("meeting_menus")
    .update({
      name: validated.name,
      duration_minutes: validated.duration_minutes,
      points_required: validated.points_required,
      zoom_account: validated.zoom_account,
      description: validated.description ?? null,
      is_active: validated.is_active,
      send_thank_you_email: validated.send_thank_you_email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single() as { data: { id: number } | null; error: { message: string } | null }

  if (error) {
    throw new Error(`メニューの更新に失敗しました: ${error.message}`)
  }

  revalidatePath("/admin/menus")
  return { success: true, menu }
}

/**
 * Delete a menu (soft delete by setting is_active = false)
 */
export async function deleteMenu(id: number) {
  await requireAdmin()

  const supabase = getSupabaseServiceRole()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("meeting_menus")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id) as { error: { message: string } | null }

  if (error) {
    throw new Error(`メニューの削除に失敗しました: ${error.message}`)
  }

  revalidatePath("/admin/menus")
  return { success: true }
}

/**
 * Get all menus (for admin)
 */
export async function getMenus() {
  await requireAdmin()

  const supabase = getSupabaseServiceRole()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: menus, error } = await (supabase as any)
    .from("meeting_menus")
    .select("*")
    .order("created_at", { ascending: false }) as {
      data: Array<{
        id: number
        name: string
        duration_minutes: number
        points_required: number
        zoom_account: "A" | "B"
        description: string | null
        is_active: boolean
        send_thank_you_email: boolean
        created_at: string
        updated_at: string
      }> | null
      error: { message: string } | null
    }

  if (error) {
    throw new Error(`メニューの取得に失敗しました: ${error.message}`)
  }

  return menus ?? []
}
