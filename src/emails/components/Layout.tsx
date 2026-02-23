/**
 * Common Email Layout Component
 */

import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Hr,
} from "@react-email/components"
import * as React from "react"

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          {children}
          <Hr style={hr} />
          <Text style={footer}>かずみん、時間空いてる？</Text>
        </Container>
      </Body>
    </Html>
  )
}

const body: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
}

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  borderRadius: "4px",
  maxWidth: "580px",
}

const hr: React.CSSProperties = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
}

const footer: React.CSSProperties = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  textAlign: "center" as const,
}

export default Layout
