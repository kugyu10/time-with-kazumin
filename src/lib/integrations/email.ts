/**
 * Email Service Integration with Resend
 * Sends booking confirmations and cancellations using React Email templates
 */

import { Resend } from "resend"
import { BookingConfirmation, type BookingConfirmationProps } from "@/emails/BookingConfirmation"
import { BookingCancellation, type BookingCancellationProps } from "@/emails/BookingCancellation"

// Lazy initialization to avoid build-time errors
let resendClient: Resend | null = null

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }

  return resendClient
}

/**
 * Check if email service is properly configured
 * Resend requires a custom domain (not gmail.com, yahoo.com, etc.)
 */
export function isEmailConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.FROM_EMAIL

  if (!apiKey || !fromEmail) {
    return false
  }

  // Resend doesn't allow public domains like gmail.com, yahoo.com, etc.
  const publicDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"]
  const domain = fromEmail.split("@")[1]?.toLowerCase()

  if (domain && publicDomains.includes(domain)) {
    return false
  }

  return true
}

export interface SendBookingConfirmationParams {
  userEmail: string
  userName: string
  sessionTitle: string
  startTime: string
  endTime: string
  zoomJoinUrl: string
  cancelUrl?: string
  googleCalendarUrl?: string
}

export interface SendEmailResult {
  userEmailSent: boolean
  adminEmailSent: boolean
}

/**
 * Send booking confirmation emails to user and admin
 */
export async function sendBookingConfirmationEmail(
  params: SendBookingConfirmationParams
): Promise<SendEmailResult> {
  const resend = getResendClient()

  if (!resend || !process.env.FROM_EMAIL) {
    console.warn("[Email] Resend not configured, skipping email send")
    return { userEmailSent: false, adminEmailSent: false }
  }

  const {
    userEmail,
    userName,
    sessionTitle,
    startTime,
    endTime,
    zoomJoinUrl,
    cancelUrl,
    googleCalendarUrl,
  } = params

  const fromEmail = process.env.FROM_EMAIL
  const adminEmail = process.env.ADMIN_EMAIL

  // Build email props for user
  const userProps: BookingConfirmationProps = {
    userName,
    sessionTitle,
    startTime,
    endTime,
    zoomJoinUrl,
    cancelUrl,
    googleCalendarUrl,
    isAdminCopy: false,
  }

  // Build email props for admin
  const adminProps: BookingConfirmationProps = {
    userName,
    sessionTitle,
    startTime,
    endTime,
    zoomJoinUrl,
    isAdminCopy: true,
  }

  // Send emails in parallel (use allSettled to handle partial failures)
  const [userResult, adminResult] = await Promise.allSettled([
    // User email
    resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: `予約確定: ${sessionTitle}`,
      react: BookingConfirmation(userProps),
    }),

    // Admin email (only if ADMIN_EMAIL is configured)
    adminEmail
      ? resend.emails.send({
          from: fromEmail,
          to: adminEmail,
          subject: `[管理者通知] 新規予約: ${sessionTitle}`,
          react: BookingConfirmation(adminProps),
        })
      : Promise.resolve(null),
  ])

  // Log results
  const userSent = userResult.status === "fulfilled" && userResult.value !== null
  const adminSent = adminResult.status === "fulfilled" && adminResult.value !== null

  if (userResult.status === "rejected") {
    console.error("[Email] User email failed:", userResult.reason)
  } else {
    console.log("[Email] User email sent:", userEmail)
  }

  if (adminResult.status === "rejected") {
    console.error("[Email] Admin email failed:", adminResult.reason)
  } else if (adminEmail) {
    console.log("[Email] Admin email sent:", adminEmail)
  }

  return {
    userEmailSent: userSent,
    adminEmailSent: adminSent,
  }
}

export interface SendBookingCancellationParams {
  userEmail: string
  userName: string
  sessionTitle: string
  originalStartTime: string
  originalEndTime: string
  isGuest?: boolean
  pointsRefunded?: number
}

/**
 * Send booking cancellation emails to user and admin
 * Uses React Email template for consistent design
 */
export async function sendBookingCancellationEmail(
  params: SendBookingCancellationParams
): Promise<SendEmailResult> {
  const resend = getResendClient()

  if (!resend || !process.env.FROM_EMAIL) {
    console.warn("[Email] Resend not configured, skipping cancellation email")
    return { userEmailSent: false, adminEmailSent: false }
  }

  const {
    userEmail,
    userName,
    sessionTitle,
    originalStartTime,
    originalEndTime,
    pointsRefunded,
  } = params

  const fromEmail = process.env.FROM_EMAIL
  const adminEmail = process.env.ADMIN_EMAIL

  // Build email props for user
  const userProps: BookingCancellationProps = {
    userName,
    sessionTitle,
    originalStartTime,
    originalEndTime,
    pointsRefunded,
    isAdminCopy: false,
  }

  // Build email props for admin
  const adminProps: BookingCancellationProps = {
    userName,
    sessionTitle,
    originalStartTime,
    originalEndTime,
    isAdminCopy: true,
  }

  // Send emails in parallel (use allSettled to handle partial failures)
  const [userResult, adminResult] = await Promise.allSettled([
    // User email
    resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: `予約キャンセル: ${sessionTitle}`,
      react: BookingCancellation(userProps),
    }),

    // Admin email (only if ADMIN_EMAIL is configured)
    adminEmail
      ? resend.emails.send({
          from: fromEmail,
          to: adminEmail,
          subject: `[管理者通知] 予約キャンセル: ${sessionTitle}`,
          react: BookingCancellation(adminProps),
        })
      : Promise.resolve(null),
  ])

  // Log results
  const userSent = userResult.status === "fulfilled" && userResult.value !== null
  const adminSent = adminResult.status === "fulfilled" && adminResult.value !== null

  if (userResult.status === "rejected") {
    console.error("[Email] Cancellation user email failed:", userResult.reason)
  } else {
    console.log("[Email] Cancellation user email sent:", userEmail)
  }

  if (adminResult.status === "rejected") {
    console.error("[Email] Cancellation admin email failed:", adminResult.reason)
  } else if (adminEmail) {
    console.log("[Email] Cancellation admin email sent:", adminEmail)
  }

  return {
    userEmailSent: userSent,
    adminEmailSent: adminSent,
  }
}

