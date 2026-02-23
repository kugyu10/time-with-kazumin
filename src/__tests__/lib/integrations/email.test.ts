import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

describe("Email Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("isEmailConfigured", () => {
    it("should return false when RESEND_API_KEY is not set", async () => {
      vi.stubEnv("RESEND_API_KEY", "")
      vi.stubEnv("FROM_EMAIL", "test@example.com")

      vi.resetModules()
      const { isEmailConfigured } = await import("@/lib/integrations/email")

      expect(isEmailConfigured()).toBe(false)
    })

    it("should return false when FROM_EMAIL is not set", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_123456")
      vi.stubEnv("FROM_EMAIL", "")

      vi.resetModules()
      const { isEmailConfigured } = await import("@/lib/integrations/email")

      expect(isEmailConfigured()).toBe(false)
    })

    it("should return true when both are set", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_123456")
      vi.stubEnv("FROM_EMAIL", "test@example.com")

      vi.resetModules()
      const { isEmailConfigured } = await import("@/lib/integrations/email")

      expect(isEmailConfigured()).toBe(true)
    })
  })

  describe("sendBookingConfirmationEmail", () => {
    const baseParams = {
      userEmail: "user@example.com",
      userName: "テストユーザー",
      sessionTitle: "かずみんセッション",
      startTime: "2024-06-15T10:00:00Z",
      endTime: "2024-06-15T11:00:00Z",
      zoomJoinUrl: "https://zoom.us/j/123456789",
    }

    it("should return false results when not configured", async () => {
      vi.stubEnv("RESEND_API_KEY", "")
      vi.stubEnv("FROM_EMAIL", "")

      vi.resetModules()
      const { sendBookingConfirmationEmail } = await import("@/lib/integrations/email")

      const result = await sendBookingConfirmationEmail(baseParams)

      expect(result.userEmailSent).toBe(false)
      expect(result.adminEmailSent).toBe(false)
    })
  })

  describe("sendBookingCancellationEmail", () => {
    const baseParams = {
      userEmail: "user@example.com",
      userName: "テストユーザー",
      sessionTitle: "かずみんセッション",
      originalStartTime: "2024-06-15T10:00:00Z",
      originalEndTime: "2024-06-15T11:00:00Z",
    }

    it("should return false results when not configured", async () => {
      vi.stubEnv("RESEND_API_KEY", "")
      vi.stubEnv("FROM_EMAIL", "")

      vi.resetModules()
      const { sendBookingCancellationEmail } = await import("@/lib/integrations/email")

      const result = await sendBookingCancellationEmail(baseParams)

      expect(result.userEmailSent).toBe(false)
      expect(result.adminEmailSent).toBe(false)
    })
  })
})
