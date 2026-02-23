import { describe, it, expect } from "vitest"
import { BookingErrorCodes } from "@/lib/bookings/types"

describe("Booking Types", () => {
  describe("BookingErrorCodes", () => {
    it("should have INSUFFICIENT_POINTS code", () => {
      expect(BookingErrorCodes.INSUFFICIENT_POINTS).toBe("insufficient_points")
    })

    it("should have SLOT_UNAVAILABLE code", () => {
      expect(BookingErrorCodes.SLOT_UNAVAILABLE).toBe("slot_unavailable")
    })

    it("should have MENU_NOT_FOUND code", () => {
      expect(BookingErrorCodes.MENU_NOT_FOUND).toBe("menu_not_found")
    })

    it("should have MEMBER_PLAN_NOT_FOUND code", () => {
      expect(BookingErrorCodes.MEMBER_PLAN_NOT_FOUND).toBe("member_plan_not_found")
    })

    it("should have LOCK_CONFLICT code", () => {
      expect(BookingErrorCodes.LOCK_CONFLICT).toBe("lock_conflict")
    })

    it("should have INTERNAL_ERROR code", () => {
      expect(BookingErrorCodes.INTERNAL_ERROR).toBe("internal_error")
    })

    it("should have all error codes as strings", () => {
      Object.values(BookingErrorCodes).forEach((code) => {
        expect(typeof code).toBe("string")
        expect(code.length).toBeGreaterThan(0)
      })
    })

    it("should have unique error codes", () => {
      const codes = Object.values(BookingErrorCodes)
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(codes.length)
    })
  })
})
