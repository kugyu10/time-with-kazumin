/**
 * Booking types and interfaces
 */

export interface BookingRequest {
  member_plan_id: number
  menu_id: number
  start_time: string
  end_time: string
  idempotency_key?: string
}

export interface BookingResponse {
  id: number
  status: "pending" | "confirmed" | "completed" | "canceled"
  zoom_join_url?: string | null
  error?: string
}

export interface SagaStep<TContext> {
  name: string
  execute: (context: TContext) => Promise<void>
  compensate?: (context: TContext) => Promise<void>
}

export interface BookingSagaContext {
  request: BookingRequest
  userId: string
  memberPlanId: number
  menuId: number
  menuName: string
  menuDuration: number
  pointsRequired: number
  startTime: string
  endTime: string

  // Results from each step
  pointsConsumed: boolean
  bookingId?: number
  zoomMeetingId?: string
  zoomJoinUrl?: string
  zoomStartUrl?: string
  zoomAccountType?: "A" | "B"
  googleEventId?: string
}

export interface CompensationFailure {
  step: string  // e.g. "create_zoom", "add_calendar"
  error: string // エラーメッセージ
}

export interface BookingSagaResult {
  success: boolean
  booking?: BookingResponse
  error?: string
  errorCode?: string
  compensationFailures?: CompensationFailure[]
}

// Error codes for client handling
export const BookingErrorCodes = {
  INSUFFICIENT_POINTS: "insufficient_points",
  SLOT_UNAVAILABLE: "slot_unavailable",
  MENU_NOT_FOUND: "menu_not_found",
  MEMBER_PLAN_NOT_FOUND: "member_plan_not_found",
  LOCK_CONFLICT: "lock_conflict",
  INTERNAL_ERROR: "internal_error",
} as const

export type BookingErrorCode = (typeof BookingErrorCodes)[keyof typeof BookingErrorCodes]
