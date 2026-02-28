import { describe, it, expect, vi } from "vitest"
import { retryWithExponentialBackoff } from "@/lib/utils/retry"

describe("retryWithExponentialBackoff", () => {
  describe("successful execution", () => {
    it("should return result on first successful attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success")

      const result = await retryWithExponentialBackoff(fn)

      expect(result).toBe("success")
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe("error handling", () => {
    it("should not retry on non-retryable status code", async () => {
      const error = { code: 400 } // Bad Request - not retryable
      const fn = vi.fn().mockRejectedValue(error)

      await expect(retryWithExponentialBackoff(fn)).rejects.toEqual(error)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it("should not retry when error has no extractable status code", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Unknown error"))

      await expect(retryWithExponentialBackoff(fn)).rejects.toThrow("Unknown error")
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe("options", () => {
    it("should use default options when not provided", async () => {
      const fn = vi.fn().mockResolvedValue("result")

      const result = await retryWithExponentialBackoff(fn)

      expect(result).toBe("result")
    })

    it("should respect custom retryableStatusCodes for non-retryable", async () => {
      // code 418 is not in the custom list [500], so should not retry
      const fn = vi.fn().mockRejectedValue({ code: 418 })

      await expect(
        retryWithExponentialBackoff(fn, {
          retryableStatusCodes: [500],
        })
      ).rejects.toEqual({ code: 418 })

      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe("error code extraction", () => {
    it("should not retry when code format is not retryable", async () => {
      const fn = vi.fn().mockRejectedValue({ code: 400 })

      await expect(retryWithExponentialBackoff(fn)).rejects.toEqual({ code: 400 })
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it("should not retry when status format is not retryable", async () => {
      const fn = vi.fn().mockRejectedValue({ status: 401 })

      await expect(retryWithExponentialBackoff(fn)).rejects.toEqual({ status: 401 })
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it("should not retry when response.status format is not retryable", async () => {
      const fn = vi.fn().mockRejectedValue({ response: { status: 404 } })

      await expect(retryWithExponentialBackoff(fn)).rejects.toEqual({
        response: { status: 404 },
      })
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
})
