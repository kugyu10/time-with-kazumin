/**
 * Point Overflow Notification Email Template
 */

import {
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components"
import * as React from "react"
import { Layout } from "./components/Layout"

export interface PointOverflowEmailProps {
  userName: string
  currentPoints: number
  monthlyPoints: number
  maxPoints: number
  overflow: number
  bookingUrl: string
}

export function PointOverflowEmail({
  userName,
  currentPoints,
  monthlyPoints,
  maxPoints,
  overflow,
  bookingUrl,
}: PointOverflowEmailProps) {
  return (
    <Layout>
      <Section style={section}>
        <Text style={heading}>{userName}さん、ポイントがもったいないです!</Text>

        <Text style={paragraph}>
          来月のポイント付与で{overflow}ポイントが使えなくなってしまいます。
          予約してかずみんに会いに来てくれると嬉しいな！
        </Text>

        <Section style={detailsSection}>
          <Text style={detailLabel}>現在のポイント</Text>
          <Text style={detailValue}>{currentPoints}ポイント</Text>

          <Text style={detailLabel}>月次付与ポイント</Text>
          <Text style={detailValue}>{monthlyPoints}ポイント</Text>

          <Text style={detailLabel}>ポイント上限</Text>
          <Text style={detailValue}>{maxPoints}ポイント</Text>

          <Text style={detailLabel}>溢れるポイント</Text>
          <Text style={detailValue}>{overflow}ポイント</Text>
        </Section>

        <Hr style={hr} />

        <Section style={buttonSection}>
          <Button href={bookingUrl} style={primaryButton}>
            今すぐ予約する
          </Button>
        </Section>
      </Section>
    </Layout>
  )
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
  backgroundColor: "#f97316",
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

export default PointOverflowEmail
