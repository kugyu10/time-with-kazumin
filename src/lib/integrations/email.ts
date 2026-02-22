/**
 * Email Service Mock Implementation
 * Phase 5で本実装に置換予定 (SendGrid/Resend)
 */

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
 * Send booking confirmation email (MOCK)
 */
export async function sendBookingConfirmationEmail(
  params: BookingConfirmationEmailParams
): Promise<{ success: boolean }> {
  console.log("[MOCK] Sending confirmation email:", params)

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 50))

  return { success: true }
}
