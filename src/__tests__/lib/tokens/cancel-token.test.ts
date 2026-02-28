import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// モジュールをモック
vi.mock("jose", async () => {
  const actual = await vi.importActual("jose")
  return {
    ...actual,
    SignJWT: class MockSignJWT {
      private payload: Record<string, unknown>

      constructor(payload: Record<string, unknown>) {
        this.payload = payload
      }

      setProtectedHeader() {
        return this
      }

      setIssuedAt() {
        return this
      }

      setExpirationTime(exp: string) {
        // 7d -> 7 * 24 * 60 * 60 seconds from now
        const now = Math.floor(Date.now() / 1000)
        const days = parseInt(exp.replace("d", ""))
        this.payload.exp = now + days * 24 * 60 * 60
        this.payload.iat = now
        return this
      }

      async sign() {
        const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
          "base64url"
        )
        const payload = Buffer.from(JSON.stringify(this.payload)).toString("base64url")
        const signature = "mock-signature"
        return `${header}.${payload}.${signature}`
      }
    },
    jwtVerify: async (token: string) => {
      const [, payloadBase64] = token.split(".")
      const payloadJson = Buffer.from(payloadBase64, "base64url").toString()
      const payload = JSON.parse(payloadJson)
      return { payload }
    },
  }
})

describe("Cancel Token", () => {
  let generateCancelToken: typeof import("@/lib/tokens/cancel-token").generateCancelToken
  let verifyCancelToken: typeof import("@/lib/tokens/cancel-token").verifyCancelToken

  beforeEach(async () => {
    vi.stubEnv("JWT_CANCEL_SECRET", "test-secret-key-for-testing")
    vi.resetModules()
    const cancelTokenModule = await import("@/lib/tokens/cancel-token")
    generateCancelToken = cancelTokenModule.generateCancelToken
    verifyCancelToken = cancelTokenModule.verifyCancelToken
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("generateCancelToken", () => {
    it("should generate a valid JWT token", async () => {
      const token = await generateCancelToken(123, "test@example.com")

      expect(token).toBeDefined()
      expect(typeof token).toBe("string")
      expect(token.split(".")).toHaveLength(3) // JWT format: header.payload.signature
    })

    it("should generate different tokens for different bookings", async () => {
      const token1 = await generateCancelToken(1, "test@example.com")
      const token2 = await generateCancelToken(2, "test@example.com")

      expect(token1).not.toBe(token2)
    })

    it("should normalize email to lowercase", async () => {
      const token = await generateCancelToken(123, "TEST@EXAMPLE.COM")
      const payload = await verifyCancelToken(token)

      expect(payload?.email).toBe("test@example.com")
    })

    it("should trim whitespace from email", async () => {
      const token = await generateCancelToken(123, "  test@example.com  ")
      const payload = await verifyCancelToken(token)

      expect(payload?.email).toBe("test@example.com")
    })
  })

  describe("verifyCancelToken", () => {
    it("should verify and return payload for valid token", async () => {
      const bookingId = 456
      const email = "user@example.com"

      const token = await generateCancelToken(bookingId, email)
      const payload = await verifyCancelToken(token)

      expect(payload).not.toBeNull()
      expect(payload?.booking_id).toBe(bookingId)
      expect(payload?.email).toBe(email)
    })
  })

  describe("token expiration", () => {
    it("should create token with 7 day expiration", async () => {
      const token = await generateCancelToken(123, "test@example.com")

      // トークンをデコードして有効期限を確認
      const [, payloadBase64] = token.split(".")
      const payloadJson = Buffer.from(payloadBase64, "base64url").toString()
      const payload = JSON.parse(payloadJson)

      const now = Math.floor(Date.now() / 1000)
      const expectedExp = now + 7 * 24 * 60 * 60 // 7 days

      // 有効期限が約7日後（許容誤差10秒）
      expect(payload.exp).toBeGreaterThan(now)
      expect(payload.exp).toBeLessThanOrEqual(expectedExp + 10)
      expect(payload.exp).toBeGreaterThanOrEqual(expectedExp - 10)
    })
  })
})
