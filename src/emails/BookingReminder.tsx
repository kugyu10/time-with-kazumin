/**
 * Booking Reminder Email Template
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

export interface BookingReminderProps {
  userName: string
  sessionTitle: string
  startTime: string
  zoomJoinUrl: string
  isAdminCopy?: boolean
}

export function BookingReminder({
  userName,
  sessionTitle,
  startTime,
  zoomJoinUrl,
  isAdminCopy = false,
}: BookingReminderProps) {
  return (
    <Layout>
      <Section style={section}>
        {isAdminCopy ? (
          <Text style={heading}>明日のセッションリマインダー</Text>
        ) : (
          <Text style={heading}>{userName}さん、明日のセッションをお忘れなく!</Text>
        )}

        <Text style={paragraph}>
          明日のセッションについてのリマインダーをお送りします。
        </Text>

        <Section style={detailsSection}>
          <Text style={detailLabel}>セッション</Text>
          <Text style={detailValue}>{sessionTitle}</Text>

          <Text style={detailLabel}>日時</Text>
          <Text style={detailValue}>
            {formatDateTime(startTime)}
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

        <Text style={reminderNote}>
          開始時刻の数分前にご参加いただけるとスムーズです。
        </Text>

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

const reminderNote: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
  textAlign: "center" as const,
  marginTop: "16px",
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

export default BookingReminder
