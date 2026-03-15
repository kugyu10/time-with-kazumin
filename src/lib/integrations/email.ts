/**
 * Email Service Integration with Resend
 * Sends booking confirmations and cancellations using React Email templates
 *
 * Note: Due to React 19.2.x compatibility issues with @react-email/render (GitHub Issue #2521),
 * we manually render React components to HTML strings instead of using Resend's `react` property.
 */

import { Resend } from "resend"
import { render } from "@react-email/render"
import { BookingConfirmation, type BookingConfirmationProps } from "@/emails/BookingConfirmation"
import { BookingCancellation, type BookingCancellationProps } from "@/emails/BookingCancellation"
import { WelcomeEmail } from "@/emails/WelcomeEmail"

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

export interface SendWelcomeEmailResult {
  success: boolean
  error?: string
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

  // Render React components to HTML strings (workaround for React 19.2.x compatibility)
  const userHtml = await render(BookingConfirmation(userProps))
  const adminHtml = adminEmail ? await render(BookingConfirmation(adminProps)) : null

  // Send emails in parallel (use allSettled to handle partial failures)
  const [userResult, adminResult] = await Promise.allSettled([
    // User email
    resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: `予約確定: ${sessionTitle}`,
      html: userHtml,
    }),

    // Admin email (only if ADMIN_EMAIL is configured)
    adminEmail && adminHtml
      ? resend.emails.send({
          from: fromEmail,
          to: adminEmail,
          subject: `[管理者通知] 新規予約: ${sessionTitle}`,
          html: adminHtml,
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

  // Render React components to HTML strings (workaround for React 19.2.x compatibility)
  const userHtml = await render(BookingCancellation(userProps))
  const adminHtml = adminEmail ? await render(BookingCancellation(adminProps)) : null

  // Send emails in parallel (use allSettled to handle partial failures)
  const [userResult, adminResult] = await Promise.allSettled([
    // User email
    resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: `予約キャンセル: ${sessionTitle}`,
      html: userHtml,
    }),

    // Admin email (only if ADMIN_EMAIL is configured)
    adminEmail && adminHtml
      ? resend.emails.send({
          from: fromEmail,
          to: adminEmail,
          subject: `[管理者通知] 予約キャンセル: ${sessionTitle}`,
          html: adminHtml,
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

export interface SendWelcomeEmailParams {
  userEmail: string
  userName: string
  passwordResetUrl: string | null
}

/**
 * Send welcome email to new member
 * Sends password reset link so the member can set their own password
 */
export async function sendWelcomeEmail(
  params: SendWelcomeEmailParams
): Promise<SendWelcomeEmailResult> {
  if (!isEmailConfigured()) {
    console.warn("[Email] Resend not configured, skipping welcome email send")
    return { success: false }
  }

  const resend = getResendClient()
  if (!resend || !process.env.FROM_EMAIL) {
    return { success: false }
  }

  const { userEmail, userName, passwordResetUrl } = params
  const fromEmail = process.env.FROM_EMAIL

  const html = await render(WelcomeEmail({ userName, passwordResetUrl }))

  try {
    await resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: "「かずみん時間」へようこそ！",
      html,
    })
    console.log("[Email] Welcome email sent:", userEmail)
    return { success: true }
  } catch (error) {
    console.error("[Email] Welcome email failed:", error)
    return { success: false, error: String(error) }
  }
}
