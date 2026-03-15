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

  describe("sendWelcomeEmail", () => {
    const baseParams = {
      userEmail: "newmember@example.com",
      userName: "新規会員",
      passwordResetUrl: "https://example.com/reset?token=abc123",
    }

    it("Test 1: should call Resend API when configured", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_123456")
      vi.stubEnv("FROM_EMAIL", "noreply@example.com")

      vi.resetModules()
      const emailModule = await import("@/lib/integrations/email")

      // fetchをモックしてResend APIコールをシミュレート
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "email-id-123" }),
      })
      global.fetch = mockFetch

      await emailModule.sendWelcomeEmail(baseParams)

      // Resend APIが呼び出されたことを確認
      expect(mockFetch).toHaveBeenCalled()
    })

    it("Test 2: should return { success: true } on Resend API success", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_123456")
      vi.stubEnv("FROM_EMAIL", "noreply@example.com")

      vi.resetModules()
      const emailModule = await import("@/lib/integrations/email")

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "email-id-456" }),
      })

      const result = await emailModule.sendWelcomeEmail(baseParams)

      expect(result.success).toBe(true)
    })

    it("Test 3: should return { success: false } when RESEND_API_KEY is not set", async () => {
      vi.stubEnv("RESEND_API_KEY", "")
      vi.stubEnv("FROM_EMAIL", "noreply@example.com")

      vi.resetModules()
      const { sendWelcomeEmail } = await import("@/lib/integrations/email")

      const result = await sendWelcomeEmail(baseParams)

      expect(result.success).toBe(false)
    })

    it("Test 4: should succeed even when passwordResetUrl is null", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_123456")
      vi.stubEnv("FROM_EMAIL", "noreply@example.com")

      vi.resetModules()
      const emailModule = await import("@/lib/integrations/email")

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "email-id-789" }),
      })

      const result = await emailModule.sendWelcomeEmail({
        ...baseParams,
        passwordResetUrl: null,
      })

      expect(result.success).toBe(true)
    })
  })
})
