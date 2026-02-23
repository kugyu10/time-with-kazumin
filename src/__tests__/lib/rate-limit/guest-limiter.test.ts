import { describe, it, expect, vi } from "vitest"

describe("checkGuestRateLimit", () => {
  describe("initial request", () => {
    it("should allow first request", async () => {
      vi.resetModules()
      const { checkGuestRateLimit: check } = await import("@/lib/rate-limit/guest-limiter")

      const result = check(`unique-ip-${Date.now()}`, `unique-${Date.now()}@example.com`)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBeGreaterThanOrEqual(0)
    })

    it("should return resetAt timestamp in the future", async () => {
      vi.resetModules()
      const { checkGuestRateLimit: check } = await import("@/lib/rate-limit/guest-limiter")

      const now = Date.now()
      const result = check(`ip-${Date.now()}`, `email-${Date.now()}@test.com`)
      expect(result.resetAt).toBeGreaterThan(now)
    })
  })

  describe("IP rate limiting", () => {
    it("should block after 5 requests from same IP", async () => {
      vi.resetModules()
      const { checkGuestRateLimit: check } = await import("@/lib/rate-limit/guest-limiter")

      const ip = `test-ip-${Date.now()}`

      // 5回のリクエスト（それぞれ異なるメールアドレスで）
      for (let i = 0; i < 5; i++) {
        const result = check(ip, `user${i}-${Date.now()}-${i}@example.com`)
        expect(result.allowed).toBe(true)
      }

      // 6回目はブロック
      const result = check(ip, `blocked-${Date.now()}@example.com`)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })

  describe("IP+Email composite rate limiting", () => {
    it("should block after 3 requests from same IP+email combination", async () => {
      vi.resetModules()
      const { checkGuestRateLimit: check } = await import("@/lib/rate-limit/guest-limiter")

      const ip = `composite-ip-${Date.now()}`
      const email = `composite-${Date.now()}@example.com`

      // 3回のリクエスト
      for (let i = 0; i < 3; i++) {
        const result = check(ip, email)
        expect(result.allowed).toBe(true)
      }

      // 4回目はブロック
      const result = check(ip, email)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })

  describe("email normalization", () => {
    it("should treat emails case-insensitively", async () => {
      vi.resetModules()
      const { checkGuestRateLimit: check } = await import("@/lib/rate-limit/guest-limiter")

      const ip = `case-ip-${Date.now()}`
      const baseEmail = `CaseTest-${Date.now()}@Example.COM`

      // 異なるケースのメールアドレスでリクエスト
      check(ip, baseEmail)
      check(ip, baseEmail.toLowerCase())
      check(ip, baseEmail.toUpperCase())

      // 4回目（同じIP+email複合キー）はブロック
      const result = check(ip, baseEmail)
      expect(result.allowed).toBe(false)
    })
  })
})
