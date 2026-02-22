"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"
import { cancelBooking as cancelBookingOrchestrator } from "@/lib/bookings/cancel"

// Validation schemas
const BookingStatusSchema = z.enum(["pending", "confirmed", "canceled", "completed"])

const UpdateStatusSchema = z.object({
  bookingId: z.number().positive(),
  status: BookingStatusSchema,
})

// Types
export type BookingStatus = z.infer<typeof BookingStatusSchema>

export type AdminBooking = {
  id: number
  start_time: string
  end_time: string
  status: BookingStatus
  zoom_meeting_id: string | null
  zoom_join_url: string | null
  google_event_id: string | null
  guest_email: string | null
  guest_name: string | null
  created_at: string
  member_plan_id: number | null
  menu_name: string
  menu_duration: number
  user_email: string | null
  user_name: string | null
  is_guest: boolean
}

export type GetBookingsFilters = {
  status?: BookingStatus
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
 * Get all bookings for admin
 */
export async function getBookings(filters?: GetBookingsFilters): Promise<AdminBooking[]> {
  await requireAdmin()

  const supabase = getSupabaseServiceRole()

  // Build query with JOINs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("bookings")
    .select(`
      id,
      start_time,
      end_time,
      status,
      zoom_meeting_id,
      zoom_join_url,
      google_event_id,
      guest_email,
      guest_name,
      created_at,
      member_plan_id,
      meeting_menus (
        name,
        duration_minutes
      ),
      member_plans (
        id,
        profiles (
          email,
          display_name
        )
      )
    `)
    .order("start_time", { ascending: false })

  // Apply filters
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  if (filters?.date_from) {
    query = query.gte("start_time", filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte("start_time", filters.date_to)
  }

  type BookingRow = {
    id: number
    start_time: string
    end_time: string
    status: BookingStatus
    zoom_meeting_id: string | null
    zoom_join_url: string | null
    google_event_id: string | null
    guest_email: string | null
    guest_name: string | null
    created_at: string
    member_plan_id: number | null
    meeting_menus: {
      name: string
      duration_minutes: number
    } | null
    member_plans: {
      id: number
      profiles: {
        email: string
        display_name: string | null
      } | null
    } | null
  }

  const { data, error } = await query as { data: BookingRow[] | null; error: { message: string } | null }

  if (error) {
    throw new Error(`予約の取得に失敗しました: ${error.message}`)
  }

  // Transform data
  return (data ?? []).map((booking) => ({
    id: booking.id,
    start_time: booking.start_time,
    end_time: booking.end_time,
    status: booking.status,
    zoom_meeting_id: booking.zoom_meeting_id,
    zoom_join_url: booking.zoom_join_url,
    google_event_id: booking.google_event_id,
    guest_email: booking.guest_email,
    guest_name: booking.guest_name,
    created_at: booking.created_at,
    member_plan_id: booking.member_plan_id,
    menu_name: booking.meeting_menus?.name ?? "不明",
    menu_duration: booking.meeting_menus?.duration_minutes ?? 0,
    user_email: booking.member_plans?.profiles?.email ?? booking.guest_email,
    user_name: booking.member_plans?.profiles?.display_name ?? booking.guest_name,
    is_guest: booking.member_plan_id === null,
  }))
}

/**
 * Update booking status
 */
export async function updateBookingStatus(bookingId: number, status: BookingStatus) {
  await requireAdmin()

  const validated = UpdateStatusSchema.parse({ bookingId, status })
  const supabase = getSupabaseServiceRole()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("bookings")
    .update({
      status: validated.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", validated.bookingId) as { error: { message: string } | null }

  if (error) {
    throw new Error(`ステータスの更新に失敗しました: ${error.message}`)
  }

  revalidatePath("/admin/bookings")
  return { success: true }
}

/**
 * Cancel booking by admin
 * Uses the existing cancelBooking orchestrator for full cleanup
 */
export async function cancelBookingByAdmin(bookingId: number) {
  await requireAdmin()

  const supabase = getSupabaseServiceRole()

  // Get booking info to determine if guest or member
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error: fetchError } = await (supabase as any)
    .from("bookings")
    .select("member_plan_id, guest_email, guest_name")
    .eq("id", bookingId)
    .single() as {
      data: { member_plan_id: number | null; guest_email: string | null; guest_name: string | null } | null
      error: { message: string } | null
    }

  if (fetchError || !booking) {
    throw new Error("予約が見つかりません")
  }

  const isGuest = booking.member_plan_id === null

  // Use the cancellation orchestrator
  // For admin cancellation, we pass isAdmin flag to skip ownership check
  const result = await cancelBookingOrchestrator(
    bookingId,
    supabase,
    undefined, // No userId for admin
    {
      isGuest,
      isAdmin: true, // 管理者キャンセル: 権限チェックをスキップ
      guestEmail: booking.guest_email ?? undefined,
      guestName: booking.guest_name ?? undefined,
    }
  )

  if (!result.success) {
    throw new Error(result.error ?? "キャンセルに失敗しました")
  }

  revalidatePath("/admin/bookings")
  return {
    success: true,
    refunded_points: result.refunded_points,
  }
}
