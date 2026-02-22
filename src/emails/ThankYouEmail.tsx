/**
 * Thank You Email Template
 */

import {
  Section,
  Text,
  Hr,
} from "@react-email/components"
import * as React from "react"
import { Layout } from "./components/Layout"

export interface ThankYouEmailProps {
  userName: string
  sessionTitle: string
  sessionDate: string
}

export function ThankYouEmail({
  userName,
  sessionTitle,
  sessionDate,
}: ThankYouEmailProps) {
  return (
    <Layout>
      <Section style={section}>
        <Text style={heading}>
          {userName}さん、本日はセッションにご参加いただきありがとうございました
        </Text>

        <Text style={paragraph}>
          本日のセッション「{sessionTitle}」にご参加いただき、誠にありがとうございました。
        </Text>

        <Section style={detailsSection}>
          <Text style={detailLabel}>セッション</Text>
          <Text style={detailValue}>{sessionTitle}</Text>

          <Text style={detailLabel}>日付</Text>
          <Text style={detailValue}>
            {formatDate(sessionDate)}
          </Text>
        </Section>

        <Hr style={hr} />

        <Text style={closingText}>
          またのご利用を心よりお待ちしております。
        </Text>
      </Section>
    </Layout>
  )
}

/**
 * Format date for display
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
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
  lineHeight: "1.4",
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

const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  marginTop: "24px",
  marginBottom: "24px",
}

const closingText: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#4a4a4a",
  textAlign: "center" as const,
}

export default ThankYouEmail
