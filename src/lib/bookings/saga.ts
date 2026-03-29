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
  type CompensationFailure,
  BookingErrorCodes,
} from "./types"
import { createZoomMeeting, deleteZoomMeeting, getZoomScheduledMeetings } from "../integrations/zoom"
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

    // Step 2.5: Check Zoom schedule conflicts (real-time, cache bypass per D-05, D-07)
    console.log("[Saga] Step 2.5: Checking Zoom schedule conflicts")
    const zoomConflict = await checkZoomConflict(context.startTime, context.endTime)
    if (zoomConflict) {
      return {
        success: false,
        error: "この時間帯はZoomの予定と重複しています",
        errorCode: BookingErrorCodes.SLOT_UNAVAILABLE,
      }
    }
    // Note: No completedSteps.push needed - this step is read-only, no compensation required

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
      const userNameForZoom = profileForZoom?.full_name || "会員"

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
      const zoomFailures = await compensateAll(supabase, context, completedSteps)
      return {
        success: false,
        error: zoomFailures.length > 0
          ? "Zoom会議の作成に失敗しました。一部のリソースのクリーンアップに失敗しました。管理者にお問い合わせください。"
          : "Zoom会議の作成に失敗しました",
        errorCode: BookingErrorCodes.INTERNAL_ERROR,
        compensationFailures: zoomFailures.length > 0 ? zoomFailures : undefined,
      }
    }

    // Step 6: Add Calendar event (with retry)
    console.log("[Saga] Step 6: Adding calendar event")
    try {
      // Get user profile for calendar event title
      const profile = await getProfileData(supabase, userId)
      const userName = profile?.full_name || "会員"

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
      const calendarFailures = await compensateAll(supabase, context, completedSteps)
      return {
        success: false,
        error: calendarFailures.length > 0
          ? "カレンダー登録に失敗しました。一部のリソースのクリーンアップに失敗しました。管理者にお問い合わせください。"
          : "カレンダー登録に失敗しました",
        errorCode: BookingErrorCodes.INTERNAL_ERROR,
        compensationFailures: calendarFailures.length > 0 ? calendarFailures : undefined,
      }
    }

    // Step 7: Confirm booking (update with Zoom and Calendar info)
    console.log("[Saga] Step 7: Confirming booking")
    const confirmResult = await confirmBooking(supabase, context)
    if (!confirmResult.success) {
      // Compensate all
      const confirmFailures = await compensateAll(supabase, context, completedSteps)
      return {
        success: false,
        error: confirmFailures.length > 0
          ? "予約の確定に失敗しました。一部のリソースのクリーンアップに失敗しました。管理者にお問い合わせください。"
          : "予約の確定に失敗しました",
        errorCode: BookingErrorCodes.INTERNAL_ERROR,
        compensationFailures: confirmFailures.length > 0 ? confirmFailures : undefined,
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
        const userName = profile.full_name || "会員"
        const googleCalendarUrl = generateGoogleCalendarUrl(
          `${context.menuName} - ${userName}`,
          context.startTime,
          context.endTime,
          context.zoomJoinUrl ? `Zoom: ${context.zoomJoinUrl}` : undefined
        )

        await sendBookingConfirmationEmail({
          userEmail: profile.email,
          userName: profile.full_name || "ゲスト",
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
    const unexpectedFailures = await compensateAll(supabase, context, completedSteps)
    return {
      success: false,
      error: unexpectedFailures.length > 0
        ? "予約処理中にエラーが発生しました。一部のリソースのクリーンアップに失敗しました。管理者にお問い合わせください。"
        : "予約処理中にエラーが発生しました",
      errorCode: BookingErrorCodes.INTERNAL_ERROR,
      compensationFailures: unexpectedFailures.length > 0 ? unexpectedFailures : undefined,
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
 * Get user profile data (email, full_name)
 */
async function getProfileData(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ email: string; full_name: string | null } | null> {
  const { data } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single()

  return data
}

/**
 * Compensation: Refund points
 * エラーは呼び出し元（compensateAll）に伝播させる
 */
async function compensatePointsRefund(
  supabase: SupabaseClient<Database>,
  context: BookingSagaContext
): Promise<void> {
  if (!context.pointsConsumed) return

  console.log("[Saga] Compensating: Refunding points")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.rpc as any)("refund_points", {
    p_member_plan_id: context.memberPlanId,
    p_points: context.pointsRequired,
    p_reference_id: context.bookingId || null,
    p_notes: "予約作成失敗による自動返還",
  })
  context.pointsConsumed = false
}

/**
 * Compensation: Cancel booking
 * エラーは呼び出し元（compensateAll）に伝播させる
 */
async function compensateBookingCancel(
  supabase: SupabaseClient<Database>,
  context: BookingSagaContext
): Promise<void> {
  if (!context.bookingId) return

  console.log("[Saga] Compensating: Canceling booking")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("bookings")
    .update({ status: "canceled" })
    .eq("id", context.bookingId)
}

/**
 * Compensation: Delete Zoom meeting (with retry)
 * エラーは呼び出し元（compensateAll）に伝播させる
 */
async function compensateZoomDelete(context: BookingSagaContext): Promise<void> {
  if (!context.zoomMeetingId) return

  console.log("[Saga] Compensating: Deleting Zoom meeting")
  await retryWithExponentialBackoff(
    () => deleteZoomMeeting(context.zoomMeetingId!, context.zoomAccountType),
    { maxRetries: 2 }
  )
}

/**
 * Compensation: Delete Calendar event (with retry)
 * エラーは呼び出し元（compensateAll）に伝播させる
 */
async function compensateCalendarDelete(context: BookingSagaContext): Promise<void> {
  if (!context.googleEventId) return

  console.log("[Saga] Compensating: Deleting calendar event")
  await retryWithExponentialBackoff(
    () => deleteCalendarEvent(context.googleEventId!),
    { maxRetries: 2 }
  )
}

/**
 * Execute all necessary compensations in reverse order
 * Returns array of failures (non-empty if any compensation step failed)
 */
async function compensateAll(
  supabase: SupabaseClient<Database>,
  context: BookingSagaContext,
  completedSteps: string[]
): Promise<CompensationFailure[]> {
  console.log("[Saga] Running compensation for steps:", completedSteps)

  const failures: CompensationFailure[] = []

  // [...completedSteps].reverse() で元の配列を破壊しない
  for (const step of [...completedSteps].reverse()) {
    switch (step) {
      case "add_calendar":
        try {
          await compensateCalendarDelete(context)
        } catch (error) {
          console.error("[Saga] Compensation failed for add_calendar:", error)
          failures.push({ step: "add_calendar", error: String(error) })
        }
        break
      case "create_zoom":
        try {
          await compensateZoomDelete(context)
        } catch (error) {
          console.error("[Saga] Compensation failed for create_zoom:", error)
          failures.push({ step: "create_zoom", error: String(error) })
        }
        break
      case "create_booking":
        try {
          await compensateBookingCancel(supabase, context)
        } catch (error) {
          console.error("[Saga] Compensation failed for create_booking:", error)
          failures.push({ step: "create_booking", error: String(error) })
        }
        break
      case "consume_points":
        try {
          await compensatePointsRefund(supabase, context)
        } catch (error) {
          console.error("[Saga] Compensation failed for consume_points:", error)
          failures.push({ step: "consume_points", error: String(error) })
        }
        break
      // check_slot and validate_menu don't need compensation
    }
  }

  return failures
}

/**
 * テスト用エクスポート（内部関数をテストから呼び出せるようにする）
 * @internal
 */
export { compensateAll as _compensateAllForTest }

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

/**
 * Check Zoom schedule conflicts (real-time, cache bypass per D-07)
 * Returns true if conflict exists
 */
async function checkZoomConflict(
  startTime: string,
  endTime: string
): Promise<boolean> {
  const [zoomAResult, zoomBResult] = await Promise.allSettled([
    getZoomScheduledMeetings("A", startTime, endTime),
    getZoomScheduledMeetings("B", startTime, endTime),
  ])

  const allBusyTimes: { start: string; end: string }[] = []
  if (zoomAResult.status === "fulfilled") allBusyTimes.push(...zoomAResult.value)
  if (zoomBResult.status === "fulfilled") allBusyTimes.push(...zoomBResult.value)

  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()

  return allBusyTimes.some((busy) => {
    const busyStart = new Date(busy.start).getTime()
    const busyEnd = new Date(busy.end).getTime()
    return start < busyEnd && end > busyStart
  })
}
