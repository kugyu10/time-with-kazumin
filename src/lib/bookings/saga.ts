/**
 * Saga Orchestrator for Booking Creation
 *
 * Implements the Saga pattern with compensation transactions
 * to ensure consistency across multiple operations.
 *
 * Phase 4: 本実装版 - Zoom, Google Calendar, Resend統合
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import {
  type BookingRequest,
  type BookingSagaContext,
  type BookingSagaResult,
  BookingErrorCodes,
} from "./types"
import { createZoomMeeting, deleteZoomMeeting } from "../integrations/zoom"
import { addCalendarEvent, deleteCalendarEvent } from "../integrations/google-calendar"
import { sendBookingConfirmationEmail } from "../integrations/email"
import { generateCancelToken } from "../tokens/cancel-token"
import { retryWithExponentialBackoff } from "@/lib/utils/retry"

const MAX_RETRIES = 3
const LOCK_CONFLICT_CODE = "55P03"

// Base URL for cancel links
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

/**
 * Sleep utility for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Generate Google Calendar add URL
 */
function generateGoogleCalendarUrl(
  title: string,
  startTime: string,
  endTime: string,
  description?: string
): string {
  const start = new Date(startTime).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const end = new Date(endTime).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    ctz: "Asia/Tokyo",
  })

  if (description) {
    params.set("details", description)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Execute booking creation with Saga pattern
 */
export async function createBookingSaga(
  request: BookingRequest,
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<BookingSagaResult> {
  // Initialize context
  const context: BookingSagaContext = {
    request,
    userId,
    memberPlanId: request.member_plan_id,
    menuId: request.menu_id,
    startTime: request.start_time,
    endTime: request.end_time,
    menuName: "",
    menuDuration: 0,
    pointsRequired: 0,
    pointsConsumed: false,
  }

  // Track completed steps for compensation
  const completedSteps: string[] = []

  try {
    // Step 1: Validate menu and get points required
    console.log("[Saga] Step 1: Validating menu")
    const menu = await validateMenu(supabase, context.menuId)
    if (!menu) {
      return {
        success: false,
        error: "メニューが見つかりません",
        errorCode: BookingErrorCodes.MENU_NOT_FOUND,
      }
    }
    context.menuName = menu.name
    context.menuDuration = menu.duration_minutes
    context.pointsRequired = menu.points_required
    completedSteps.push("validate_menu")

    // Step 2: Check slot availability (using DB EXCLUDE constraint as backup)
    console.log("[Saga] Step 2: Checking slot availability")
    const slotAvailable = await checkSlotAvailability(
      supabase,
      context.startTime,
      context.endTime
    )
    if (!slotAvailable) {
      return {
        success: false,
        error: "この時間帯は既に予約されています",
        errorCode: BookingErrorCodes.SLOT_UNAVAILABLE,
      }
    }
    completedSteps.push("check_slot")

    // Step 3: Consume points with retry for lock conflicts
    console.log("[Saga] Step 3: Consuming points")
    const pointsResult = await consumePointsWithRetry(
      supabase,
      context.memberPlanId,
      context.pointsRequired
    )
    if (!pointsResult.success) {
      return {
        success: false,
        error: pointsResult.error || "ポイント消費に失敗しました",
        errorCode: pointsResult.errorCode,
      }
    }
    context.pointsConsumed = true
    completedSteps.push("consume_points")

    // Step 4: Create booking record (status: confirmed initially)
    console.log("[Saga] Step 4: Creating booking record")
    const bookingResult = await createBookingRecord(supabase, context)
    if (!bookingResult.success || !bookingResult.bookingId) {
      // Compensate: refund points
      await compensatePointsRefund(supabase, context)
      return {
        success: false,
        error: bookingResult.error || "予約の作成に失敗しました",
        errorCode: BookingErrorCodes.INTERNAL_ERROR,
      }
    }
    context.bookingId = bookingResult.bookingId
    completedSteps.push("create_booking")

    // Step 5: Create Zoom meeting
    console.log("[Saga] Step 5: Creating Zoom meeting")
    try {
      // Get user profile for Zoom topic
      const profileForZoom = await getProfileData(supabase, userId)
      const userNameForZoom = profileForZoom?.display_name || profileForZoom?.full_name || "会員"

      // Get zoom_account from menu (default to 'A')
      const zoomAccount = await getMenuZoomAccount(supabase, context.menuId)
      const zoomResult = await createZoomMeeting({
        topic: `${context.menuName} - ${userNameForZoom}`,
        start_time: context.startTime,
        duration: context.menuDuration,
        accountType: zoomAccount,
      })
      context.zoomAccountType = zoomAccount
      context.zoomMeetingId = zoomResult.zoom_meeting_id
      context.zoomJoinUrl = zoomResult.zoom_join_url
      context.zoomStartUrl = zoomResult.zoom_start_url
      completedSteps.push("create_zoom")
    } catch (error) {
      console.error("[Saga] Zoom meeting creation failed:", error)
      // Compensate: cancel booking and refund points
      await compensateAll(supabase, context, completedSteps)
      return {
        success: false,
        error: "Zoom会議の作成に失敗しました",
        errorCode: BookingErrorCodes.INTERNAL_ERROR,
      }
    }

    // Step 6: Add Calendar event (with retry)
    console.log("[Saga] Step 6: Adding calendar event")
    try {
      // Get user profile for calendar event title
      const profile = await getProfileData(supabase, userId)
      const userName = profile?.display_name || profile?.full_name || "会員"

      const calendarResult = await retryWithExponentialBackoff(
        () =>
          addCalendarEvent({
            summary: `${context.menuName} - ${userName}`,
            start: context.startTime,
            end: context.endTime,
            description: context.zoomJoinUrl
              ? `Zoom: ${context.zoomJoinUrl}`
              : undefined,
          }),
        { maxRetries: 3 }
      )
      context.googleEventId = calendarResult.google_event_id
      completedSteps.push("add_calendar")
    } catch (error) {
      console.error("[Saga] Calendar event creation failed:", error)
      // Compensate: delete Zoom, cancel booking, refund points
      await compensateAll(supabase, context, completedSteps)
      return {
        success: false,
        error: "カレンダー登録に失敗しました",
        errorCode: BookingErrorCodes.INTERNAL_ERROR,
      }
    }

    // Step 7: Confirm booking (update with Zoom and Calendar info)
    console.log("[Saga] Step 7: Confirming booking")
    const confirmResult = await confirmBooking(supabase, context)
    if (!confirmResult.success) {
      // Compensate all
      await compensateAll(supabase, context, completedSteps)
      return {
        success: false,
        error: "予約の確定に失敗しました",
        errorCode: BookingErrorCodes.INTERNAL_ERROR,
      }
    }
    completedSteps.push("confirm_booking")

    // Step 8: Send confirmation email (non-critical, continue on failure)
    console.log("[Saga] Step 8: Sending confirmation email")
    try {
      const profile = await getProfileData(supabase, userId)
      if (profile?.email) {
        // Generate cancel token for email
        const cancelToken = await generateCancelToken(context.bookingId, profile.email)
        const cancelUrl = `${APP_BASE_URL}/guest/cancel/${cancelToken}`

        // Generate Google Calendar URL
        const userName = profile.display_name || profile.full_name || "会員"
        const googleCalendarUrl = generateGoogleCalendarUrl(
          `${context.menuName} - ${userName}`,
          context.startTime,
          context.endTime,
          context.zoomJoinUrl ? `Zoom: ${context.zoomJoinUrl}` : undefined
        )

        await sendBookingConfirmationEmail({
          userEmail: profile.email,
          userName: profile.display_name || "ゲスト",
          sessionTitle: context.menuName,
          startTime: context.startTime,
          endTime: context.endTime,
          zoomJoinUrl: context.zoomJoinUrl || "",
          cancelUrl,
          googleCalendarUrl,
        })
      }
    } catch (error) {
      // Email is non-critical, log and continue
      console.warn("[Saga] Email sending failed (non-critical):", error)
    }

    // Success!
    console.log("[Saga] Booking created successfully:", context.bookingId)
    return {
      success: true,
      booking: {
        id: context.bookingId,
        status: "confirmed",
        zoom_join_url: context.zoomJoinUrl,
      },
    }
  } catch (error) {
    console.error("[Saga] Unexpected error:", error)
    // Compensate all completed steps
    await compensateAll(supabase, context, completedSteps)
    return {
      success: false,
      error: "予約処理中にエラーが発生しました",
      errorCode: BookingErrorCodes.INTERNAL_ERROR,
    }
  }
}

/**
 * Validate menu exists and is active
 */
async function validateMenu(
  supabase: SupabaseClient<Database>,
  menuId: number
): Promise<{ name: string; duration_minutes: number; points_required: number } | null> {
  const { data, error } = await supabase
    .from("meeting_menus")
    .select("name, duration_minutes, points_required")
    .eq("id", menuId)
    .eq("is_active", true)
    .single()

  if (error || !data) {
    return null
  }
  return data
}

/**
 * Check if time slot is available
 */
async function checkSlotAvailability(
  supabase: SupabaseClient<Database>,
  startTime: string,
  endTime: string
): Promise<boolean> {
  // Check for overlapping confirmed bookings
  // DB has EXCLUDE constraint as backup, but we check here first for better UX
  const { data, error } = await supabase
    .from("bookings")
    .select("id")
    .neq("status", "canceled")
    .lt("start_time", endTime)
    .gt("end_time", startTime)
    .limit(1)

  if (error) {
    console.error("[Saga] Slot availability check failed:", error)
    throw error
  }

  return !data || data.length === 0
}

/**
 * Consume points with exponential backoff retry for lock conflicts
 */
async function consumePointsWithRetry(
  supabase: SupabaseClient<Database>,
  memberPlanId: number,
  points: number
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)("consume_points", {
        p_member_plan_id: memberPlanId,
        p_points: points,
        p_transaction_type: "consume",
        p_reference_id: null,
        p_notes: null,
      })

      if (error) {
        // Check for lock conflict
        if (error.code === LOCK_CONFLICT_CODE) {
          const delay = 100 * Math.pow(2, attempt)
          console.log(`[Saga] Lock conflict, retrying in ${delay}ms...`)
          await sleep(delay)
          continue
        }

        // Check for insufficient points
        if (error.message?.includes("Insufficient points")) {
          return {
            success: false,
            error: "ポイント残高が不足しています",
            errorCode: BookingErrorCodes.INSUFFICIENT_POINTS,
          }
        }

        // Other error
        console.error("[Saga] consume_points failed:", error)
        return {
          success: false,
          error: "ポイント消費に失敗しました",
          errorCode: BookingErrorCodes.INTERNAL_ERROR,
        }
      }

      return { success: true }
    } catch (err) {
      console.error("[Saga] consume_points exception:", err)
      if (attempt === MAX_RETRIES - 1) {
        return {
          success: false,
          error: "ポイント消費に失敗しました",
          errorCode: BookingErrorCodes.LOCK_CONFLICT,
        }
      }
    }
  }

  return {
    success: false,
    error: "ポイント消費のリトライ上限に達しました",
    errorCode: BookingErrorCodes.LOCK_CONFLICT,
  }
}

/**
 * Create booking record with pending status
 */
async function createBookingRecord(
  supabase: SupabaseClient<Database>,
  context: BookingSagaContext
): Promise<{ success: boolean; bookingId?: number; error?: string }> {
  // Use 'confirmed' status initially since 'pending' isn't in the DB schema
  // The final confirmation step will update with Zoom/Calendar info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("bookings")
    .insert({
      member_plan_id: context.memberPlanId,
      menu_id: context.menuId,
      start_time: context.startTime,
      end_time: context.endTime,
      status: "confirmed",
      zoom_meeting_id: null,
      zoom_join_url: null,
      google_event_id: null,
    })
    .select("id")
    .single() as { data: { id: number } | null; error: { code: string; message: string } | null }

  if (error || !data) {
    console.error("[Saga] Booking creation failed:", error)
    // Check for EXCLUDE constraint violation (double booking)
    if (error?.code === "23P01") {
      return {
        success: false,
        error: "この時間帯は既に予約されています",
      }
    }
    return { success: false, error: "予約の作成に失敗しました" }
  }

  return { success: true, bookingId: data.id }
}

/**
 * Update booking with Zoom and Calendar info, confirm status
 */
async function confirmBooking(
  supabase: SupabaseClient<Database>,
  context: BookingSagaContext
): Promise<{ success: boolean }> {
  if (!context.bookingId) {
    return { success: false }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("bookings")
    .update({
      zoom_meeting_id: context.zoomMeetingId || null,
      zoom_join_url: context.zoomJoinUrl || null,
      google_event_id: context.googleEventId || null,
      status: "confirmed",
    })
    .eq("id", context.bookingId)

  if (error) {
    console.error("[Saga] Booking confirmation failed:", error)
    return { success: false }
  }

  return { success: true }
}

/**
 * Get user profile data (email, display_name, full_name)
 */
async function getProfileData(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ email: string; display_name: string | null; full_name: string | null } | null> {
  const { data } = await supabase
    .from("profiles")
    .select("email, display_name, full_name")
    .eq("id", userId)
    .single()

  return data
}

/**
 * Compensation: Refund points
 */
async function compensatePointsRefund(
  supabase: SupabaseClient<Database>,
  context: BookingSagaContext
): Promise<void> {
  if (!context.pointsConsumed) return

  console.log("[Saga] Compensating: Refunding points")
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.rpc as any)("refund_points", {
      p_member_plan_id: context.memberPlanId,
      p_points: context.pointsRequired,
      p_reference_id: context.bookingId || null,
      p_notes: "予約作成失敗による自動返還",
    })
    context.pointsConsumed = false
  } catch (error) {
    console.error("[Saga] Points refund failed:", error)
    // Log for manual intervention
  }
}

/**
 * Compensation: Cancel booking
 */
async function compensateBookingCancel(
  supabase: SupabaseClient<Database>,
  context: BookingSagaContext
): Promise<void> {
  if (!context.bookingId) return

  console.log("[Saga] Compensating: Canceling booking")
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("bookings")
      .update({ status: "canceled" })
      .eq("id", context.bookingId)
  } catch (error) {
    console.error("[Saga] Booking cancellation failed:", error)
  }
}

/**
 * Compensation: Delete Zoom meeting (with retry)
 */
async function compensateZoomDelete(context: BookingSagaContext): Promise<void> {
  if (!context.zoomMeetingId) return

  console.log("[Saga] Compensating: Deleting Zoom meeting")
  try {
    await retryWithExponentialBackoff(
      () => deleteZoomMeeting(context.zoomMeetingId!, context.zoomAccountType),
      { maxRetries: 2 }
    )
  } catch (error) {
    console.error("[Saga] Zoom deletion failed:", error)
  }
}

/**
 * Compensation: Delete Calendar event (with retry)
 */
async function compensateCalendarDelete(context: BookingSagaContext): Promise<void> {
  if (!context.googleEventId) return

  console.log("[Saga] Compensating: Deleting calendar event")
  try {
    await retryWithExponentialBackoff(
      () => deleteCalendarEvent(context.googleEventId!),
      { maxRetries: 2 }
    )
  } catch (error) {
    console.error("[Saga] Calendar deletion failed:", error)
  }
}

/**
 * Execute all necessary compensations in reverse order
 */
async function compensateAll(
  supabase: SupabaseClient<Database>,
  context: BookingSagaContext,
  completedSteps: string[]
): Promise<void> {
  console.log("[Saga] Running compensation for steps:", completedSteps)

  // Reverse order compensation
  for (const step of completedSteps.reverse()) {
    switch (step) {
      case "add_calendar":
        await compensateCalendarDelete(context)
        break
      case "create_zoom":
        await compensateZoomDelete(context)
        break
      case "create_booking":
        await compensateBookingCancel(supabase, context)
        break
      case "consume_points":
        await compensatePointsRefund(supabase, context)
        break
      // check_slot and validate_menu don't need compensation
    }
  }
}

/**
 * Get zoom_account setting from menu
 */
async function getMenuZoomAccount(
  supabase: SupabaseClient<Database>,
  menuId: number
): Promise<"A" | "B"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("meeting_menus")
    .select("zoom_account")
    .eq("id", menuId)
    .single()

  return (data?.zoom_account as "A" | "B") || "A"
}
