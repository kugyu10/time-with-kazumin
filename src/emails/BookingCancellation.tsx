/**
 * Booking Cancellation Email Template
 */

import {
  Section,
  Text,
  Hr,
} from "@react-email/components"
import * as React from "react"
import { Layout } from "./components/Layout"

export interface BookingCancellationProps {
  userName: string
  sessionTitle: string
  originalStartTime: string
  originalEndTime: string
  isAdminCopy?: boolean
  pointsRefunded?: number
}

export function BookingCancellation({
  userName,
  sessionTitle,
  originalStartTime,
  originalEndTime,
  isAdminCopy = false,
  pointsRefunded,
}: BookingCancellationProps) {
  return (
    <Layout>
      <Section style={section}>
        {isAdminCopy ? (
          <Text style={heading}>予約がキャンセルされました</Text>
        ) : (
          <Text style={heading}>{userName}さん、予約がキャンセルされました</Text>
        )}

        <Text style={paragraph}>
          以下の予約がキャンセルされました。
        </Text>

        <Section style={detailsSection}>
          <Text style={detailLabel}>セッション</Text>
          <Text style={detailValue}>{sessionTitle}</Text>

          <Text style={detailLabel}>元の予約日時</Text>
          <Text style={detailValue}>
            {formatDateTime(originalStartTime)} - {formatTime(originalEndTime)}
          </Text>

          {pointsRefunded !== undefined && pointsRefunded > 0 && (
            <>
              <Text style={detailLabel}>ポイント返還</Text>
              <Text style={detailValue}>
                {pointsRefunded} ポイントが返還されました
              </Text>
            </>
          )}
        </Section>

        <Hr style={hr} />

        {isAdminCopy ? (
          <Section style={adminNote}>
            <Text style={adminNoteText}>
              キャンセル者: {userName}
            </Text>
          </Section>
        ) : (
          <Text style={footerText}>
            またのご予約をお待ちしております。
          </Text>
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
  backgroundColor: "#fef3c7",
  borderRadius: "8px",
  padding: "16px",
  marginTop: "16px",
}

const detailLabel: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: "600",
  color: "#92400e",
  textTransform: "uppercase" as const,
  marginBottom: "4px",
}

const detailValue: React.CSSProperties = {
  fontSize: "16px",
  color: "#1a1a1a",
  marginTop: "0",
  marginBottom: "16px",
}

const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  marginTop: "24px",
  marginBottom: "24px",
}

const footerText: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
  textAlign: "center" as const,
}

const adminNote: React.CSSProperties = {
  marginTop: "16px",
  padding: "12px",
  backgroundColor: "#fef3c7",
  borderRadius: "8px",
}

const adminNoteText: React.CSSProperties = {
  fontSize: "14px",
  color: "#92400e",
  margin: "0",
}

export default BookingCancellation
