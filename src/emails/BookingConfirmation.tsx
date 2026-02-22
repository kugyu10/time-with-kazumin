/**
 * Booking Confirmation Email Template
 */

import {
  Section,
  Text,
  Button,
  Hr,
  Link,
} from "@react-email/components"
import * as React from "react"
import { Layout } from "./components/Layout"

export interface BookingConfirmationProps {
  userName: string
  sessionTitle: string
  startTime: string
  endTime: string
  zoomJoinUrl: string
  cancelUrl?: string
  googleCalendarUrl?: string
  isAdminCopy?: boolean
}

export function BookingConfirmation({
  userName,
  sessionTitle,
  startTime,
  endTime,
  zoomJoinUrl,
  cancelUrl,
  googleCalendarUrl,
  isAdminCopy = false,
}: BookingConfirmationProps) {
  return (
    <Layout>
      <Section style={section}>
        {isAdminCopy ? (
          <Text style={heading}>新規予約がありました</Text>
        ) : (
          <Text style={heading}>{userName}さん、予約が完了しました</Text>
        )}

        <Text style={paragraph}>
          以下の内容で予約が確定しました。
        </Text>

        <Section style={detailsSection}>
          <Text style={detailLabel}>セッション</Text>
          <Text style={detailValue}>{sessionTitle}</Text>

          <Text style={detailLabel}>日時</Text>
          <Text style={detailValue}>
            {formatDateTime(startTime)} - {formatTime(endTime)}
          </Text>

          <Text style={detailLabel}>Zoomリンク</Text>
          <Link href={zoomJoinUrl} style={link}>
            {zoomJoinUrl}
          </Link>
        </Section>

        <Hr style={hr} />

        <Section style={buttonSection}>
          <Button href={zoomJoinUrl} style={primaryButton}>
            Zoomミーティングに参加
          </Button>
        </Section>

        {googleCalendarUrl && (
          <Section style={buttonSection}>
            <Button href={googleCalendarUrl} style={secondaryButton}>
              Googleカレンダーに追加
            </Button>
          </Section>
        )}

        {/* Cancel link only shown to users, not in admin copy */}
        {!isAdminCopy && cancelUrl && (
          <Section style={cancelSection}>
            <Text style={cancelText}>
              ご都合が悪くなった場合は
              <Link href={cancelUrl} style={cancelLink}>
                こちらからキャンセル
              </Link>
              できます。
            </Text>
          </Section>
        )}

        {isAdminCopy && (
          <Section style={adminNote}>
            <Text style={adminNoteText}>
              予約者: {userName}
            </Text>
          </Section>
        )}
      </Section>
    </Layout>
  )
}

/**
 * Format date and time for display
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
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

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  })
}

// Styles
const section: React.CSSProperties = {
  padding: "24px",
}

const heading: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "#1a1a1a",
  marginBottom: "16px",
}

const paragraph: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#4a4a4a",
}

const detailsSection: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  borderRadius: "8px",
  padding: "16px",
  marginTop: "16px",
}

const detailLabel: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: "600",
  color: "#6b7280",
  textTransform: "uppercase" as const,
  marginBottom: "4px",
}

const detailValue: React.CSSProperties = {
  fontSize: "16px",
  color: "#1a1a1a",
  marginTop: "0",
  marginBottom: "16px",
}

const link: React.CSSProperties = {
  color: "#2563eb",
  textDecoration: "none",
  fontSize: "14px",
  wordBreak: "break-all" as const,
}

const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  marginTop: "24px",
  marginBottom: "24px",
}

const buttonSection: React.CSSProperties = {
  textAlign: "center" as const,
  marginBottom: "12px",
}

const primaryButton: React.CSSProperties = {
  backgroundColor: "#2563eb",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  width: "100%",
  padding: "12px 24px",
}

const secondaryButton: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  color: "#374151",
  fontSize: "14px",
  fontWeight: "500",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  width: "100%",
  padding: "10px 20px",
}

const cancelSection: React.CSSProperties = {
  marginTop: "24px",
  textAlign: "center" as const,
}

const cancelText: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
}

const cancelLink: React.CSSProperties = {
  color: "#dc2626",
  textDecoration: "underline",
}

const adminNote: React.CSSProperties = {
  marginTop: "24px",
  padding: "12px",
  backgroundColor: "#fef3c7",
  borderRadius: "8px",
}

const adminNoteText: React.CSSProperties = {
  fontSize: "14px",
  color: "#92400e",
  margin: "0",
}

export default BookingConfirmation
