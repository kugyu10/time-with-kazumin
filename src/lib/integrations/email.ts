/**
 * Email Service Integration with Resend
 * Sends booking confirmations and cancellations using React Email templates
 */

import { Resend } from "resend"
import { BookingConfirmation, type BookingConfirmationProps } from "@/emails/BookingConfirmation"

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
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.FROM_EMAIL
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
  startTime: string
  endTime: string
}

/**
 * Send booking cancellation emails to user and admin
 * (Used by 04-03 cancellation flow)
 */
export async function sendBookingCancellationEmail(
  params: SendBookingCancellationParams
): Promise<SendEmailResult> {
  const resend = getResendClient()

  if (!resend || !process.env.FROM_EMAIL) {
    console.warn("[Email] Resend not configured, skipping cancellation email")
    return { userEmailSent: false, adminEmailSent: false }
  }

  const { userEmail, userName, sessionTitle, startTime, endTime } = params
  const fromEmail = process.env.FROM_EMAIL
  const adminEmail = process.env.ADMIN_EMAIL

  const formatDate = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
    })
  }

  const userHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a1a;">予約がキャンセルされました</h1>
      <p>${userName}さん、以下の予約がキャンセルされました。</p>
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
        <p><strong>セッション:</strong> ${sessionTitle}</p>
        <p><strong>日時:</strong> ${formatDate(startTime)} - ${formatDate(endTime)}</p>
      </div>
      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
        またのご予約をお待ちしております。
      </p>
      <hr style="border-color: #e5e7eb; margin: 24px 0;" />
      <p style="color: #8898aa; font-size: 12px; text-align: center;">Time with Kazumin</p>
    </div>
  `

  const adminHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a1a;">予約キャンセル通知</h1>
      <div style="background: #fef3c7; padding: 12px; border-radius: 8px;">
        <p style="color: #92400e; margin: 0;">予約者: ${userName} (${userEmail})</p>
      </div>
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-top: 16px;">
        <p><strong>セッション:</strong> ${sessionTitle}</p>
        <p><strong>日時:</strong> ${formatDate(startTime)} - ${formatDate(endTime)}</p>
      </div>
      <hr style="border-color: #e5e7eb; margin: 24px 0;" />
      <p style="color: #8898aa; font-size: 12px; text-align: center;">Time with Kazumin</p>
    </div>
  `

  const [userResult, adminResult] = await Promise.allSettled([
    resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: `予約キャンセル: ${sessionTitle}`,
      html: userHtml,
    }),

    adminEmail
      ? resend.emails.send({
          from: fromEmail,
          to: adminEmail,
          subject: `[管理者通知] 予約キャンセル: ${sessionTitle}`,
          html: adminHtml,
        })
      : Promise.resolve(null),
  ])

  const userSent = userResult.status === "fulfilled" && userResult.value !== null
  const adminSent = adminResult.status === "fulfilled" && adminResult.value !== null

  if (userResult.status === "rejected") {
    console.error("[Email] Cancellation user email failed:", userResult.reason)
  }
  if (adminResult.status === "rejected") {
    console.error("[Email] Cancellation admin email failed:", adminResult.reason)
  }

  return {
    userEmailSent: userSent,
    adminEmailSent: adminSent,
  }
}

// Legacy interface for backward compatibility with existing saga
export interface BookingConfirmationEmailParams {
  to: string
  bookingDetails: {
    menuName: string
    startTime: string
    endTime: string
    zoomJoinUrl?: string
  }
}

/**
 * Legacy function for backward compatibility
 * Used by existing saga until it's updated in Task 3
 */
export async function sendBookingConfirmationEmailLegacy(
  params: BookingConfirmationEmailParams
): Promise<{ success: boolean }> {
  const result = await sendBookingConfirmationEmail({
    userEmail: params.to,
    userName: "ゲスト", // Will be updated in Task 3
    sessionTitle: params.bookingDetails.menuName,
    startTime: params.bookingDetails.startTime,
    endTime: params.bookingDetails.endTime,
    zoomJoinUrl: params.bookingDetails.zoomJoinUrl || "",
  })

  return { success: result.userEmailSent }
}
