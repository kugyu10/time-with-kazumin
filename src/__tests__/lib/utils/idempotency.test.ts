import { describe, it, expect, vi } from "vitest"
import {
  generateIdempotencyKey,
  hashRequest,
  IdempotencyConflictError,
} from "@/lib/utils/idempotency"

describe("Idempotency utilities", () => {
  describe("generateIdempotencyKey", () => {
    it("should generate a 21-character key", () => {
      const key = generateIdempotencyKey()

      expect(key).toBeDefined()
      expect(key).toHaveLength(21)
    })

    it("should generate unique keys", () => {
      const keys = new Set<string>()

      for (let i = 0; i < 100; i++) {
        keys.add(generateIdempotencyKey())
      }

      expect(keys.size).toBe(100)
    })

    it("should generate URL-safe characters", () => {
      const key = generateIdempotencyKey()

      // nanoid default alphabet is URL-safe
      expect(key).toMatch(/^[A-Za-z0-9_-]+$/)
    })
  })

  describe("hashRequest", () => {
    it("should generate a SHA-256 hash", async () => {
      const body = { email: "test@example.com", bookingId: 123 }
      const hash = await hashRequest(body)

      expect(hash).toBeDefined()
      expect(hash).toHaveLength(64) // SHA-256 produces 64 hex characters
    })

    it("should generate same hash for same body", async () => {
      const body1 = { email: "test@example.com", bookingId: 123 }
      const body2 = { email: "test@example.com", bookingId: 123 }

      const hash1 = await hashRequest(body1)
      const hash2 = await hashRequest(body2)

      expect(hash1).toBe(hash2)
    })

    it("should generate different hash for different body", async () => {
      const body1 = { email: "test@example.com", bookingId: 123 }
      const body2 = { email: "test@example.com", bookingId: 456 }

      const hash1 = await hashRequest(body1)
      const hash2 = await hashRequest(body2)

      expect(hash1).not.toBe(hash2)
    })

    it("should be sensitive to key order", async () => {
      // JSON.stringify maintains key order, so different orders produce different hashes
      const body1 = { a: 1, b: 2 }
      const body2 = { b: 2, a: 1 }

      const hash1 = await hashRequest(body1)
      const hash2 = await hashRequest(body2)

      // Note: This test documents current behavior - order matters
      expect(hash1).not.toBe(hash2)
    })

    it("should handle nested objects", async () => {
      const body = {
        user: { email: "test@example.com", name: "Test" },
        booking: { date: "2024-06-15", time: "10:00" },
      }

      const hash = await hashRequest(body)

      expect(hash).toBeDefined()
      expect(hash).toHaveLength(64)
    })

    it("should handle arrays", async () => {
      const body = {
        items: [1, 2, 3],
        tags: ["a", "b", "c"],
      }

      const hash = await hashRequest(body)

      expect(hash).toBeDefined()
      expect(hash).toHaveLength(64)
    })

    it("should handle empty object", async () => {
      const hash = await hashRequest({})

      expect(hash).toBeDefined()
      expect(hash).toHaveLength(64)
    })

    it("should handle special characters", async () => {
      const body = {
        text: "日本語テキスト 🎉",
        special: "<>&\"'",
      }

      const hash = await hashRequest(body)

      expect(hash).toBeDefined()
      expect(hash).toHaveLength(64)
    })
  })

  describe("IdempotencyConflictError", () => {
    it("should be an instance of Error", () => {
      const error = new IdempotencyConflictError()

      expect(error).toBeInstanceOf(Error)
    })

    it("should have correct name", () => {
      const error = new IdempotencyConflictError()

      expect(error.name).toBe("IdempotencyConflictError")
    })

    it("should have correct message", () => {
      const error = new IdempotencyConflictError()

      expect(error.message).toBe("Idempotency key already used with different request body")
    })
  })
})
