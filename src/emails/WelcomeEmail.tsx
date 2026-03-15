/**
 * Welcome Email Template
 * 新規会員へのウェルカムメール
 */

import {
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components"
import * as React from "react"
import { Layout } from "./components/Layout"

export interface WelcomeEmailProps {
  userName: string
  passwordResetUrl: string | null
}

export function WelcomeEmail({ userName, passwordResetUrl }: WelcomeEmailProps) {
  return (
    <Layout>
      <Section style={section}>
        <Text style={heading}>{userName}さん、ようこそ！</Text>

        <Text style={paragraph}>
          「かずみん時間」へようこそ。
          <br />
          会員登録が完了しました。
        </Text>

        {passwordResetUrl ? (
          <>
            <Text style={paragraph}>
              下記のボタンからパスワードを設定してください。
              <br />
              <strong>パスワード設定リンクの有効期限: 1時間</strong>
            </Text>

            <Section style={buttonSection}>
              <Button href={passwordResetUrl} style={primaryButton}>
                パスワードを設定する
              </Button>
            </Section>
          </>
        ) : (
          <Text style={paragraph}>
            パスワードの設定については、管理者にお問い合わせください。
          </Text>
        )}

        <Hr style={hr} />

        <Text style={footerText}>
          ご不明な点がございましたら、管理者までお問い合わせください。
        </Text>
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

const footerText: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
}

export default WelcomeEmail
