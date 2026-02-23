import { describe, it, expect } from "vitest"
import { generateGoogleCalendarUrl } from "@/lib/calendar/url-generator"

describe("generateGoogleCalendarUrl", () => {
  const baseParams = {
    title: "テストミーティング",
    startTime: new Date("2024-06-15T10:00:00Z"),
    endTime: new Date("2024-06-15T11:00:00Z"),
  }

  describe("basic URL generation", () => {
    it("should generate a valid Google Calendar URL", () => {
      const url = generateGoogleCalendarUrl(baseParams)

      expect(url).toContain("https://calendar.google.com/calendar/r/eventedit")
    })

    it("should include title in URL", () => {
      const url = generateGoogleCalendarUrl(baseParams)
      const parsedUrl = new URL(url)

      expect(parsedUrl.searchParams.get("text")).toBe("テストミーティング")
    })

    it("should include formatted dates in URL", () => {
      const url = generateGoogleCalendarUrl(baseParams)
      const parsedUrl = new URL(url)
      const dates = parsedUrl.searchParams.get("dates")

      expect(dates).toBeDefined()
      expect(dates).toContain("/")
      // Format: YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ
      expect(dates).toMatch(/^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/)
    })
  })

  describe("date formatting", () => {
    it("should format start date correctly", () => {
      const url = generateGoogleCalendarUrl(baseParams)
      const parsedUrl = new URL(url)
      const dates = parsedUrl.searchParams.get("dates")!
      const [startDate] = dates.split("/")

      // 2024-06-15T10:00:00Z -> 20240615T100000Z
      expect(startDate).toBe("20240615T100000Z")
    })

    it("should format end date correctly", () => {
      const url = generateGoogleCalendarUrl(baseParams)
      const parsedUrl = new URL(url)
      const dates = parsedUrl.searchParams.get("dates")!
      const [, endDate] = dates.split("/")

      // 2024-06-15T11:00:00Z -> 20240615T110000Z
      expect(endDate).toBe("20240615T110000Z")
    })

    it("should handle different timezones correctly", () => {
      const params = {
        title: "Test",
        startTime: new Date("2024-12-31T23:30:00Z"),
        endTime: new Date("2025-01-01T00:30:00Z"),
      }

      const url = generateGoogleCalendarUrl(params)
      const parsedUrl = new URL(url)
      const dates = parsedUrl.searchParams.get("dates")!

      expect(dates).toContain("20241231T233000Z")
      expect(dates).toContain("20250101T003000Z")
    })
  })

  describe("optional parameters", () => {
    it("should include description when provided", () => {
      const params = {
        ...baseParams,
        description: "これはテストの説明です",
      }

      const url = generateGoogleCalendarUrl(params)
      const parsedUrl = new URL(url)

      expect(parsedUrl.searchParams.get("details")).toBe("これはテストの説明です")
    })

    it("should not include description when not provided", () => {
      const url = generateGoogleCalendarUrl(baseParams)
      const parsedUrl = new URL(url)

      expect(parsedUrl.searchParams.has("details")).toBe(false)
    })

    it("should include location when provided", () => {
      const params = {
        ...baseParams,
        location: "https://zoom.us/j/123456789",
      }

      const url = generateGoogleCalendarUrl(params)
      const parsedUrl = new URL(url)

      expect(parsedUrl.searchParams.get("location")).toBe("https://zoom.us/j/123456789")
    })

    it("should not include location when not provided", () => {
      const url = generateGoogleCalendarUrl(baseParams)
      const parsedUrl = new URL(url)

      expect(parsedUrl.searchParams.has("location")).toBe(false)
    })
  })

  describe("special characters", () => {
    it("should handle special characters in title", () => {
      const params = {
        ...baseParams,
        title: "Meeting & Discussion: Test / Demo",
      }

      const url = generateGoogleCalendarUrl(params)

      // URLが正しく生成されることを確認
      expect(() => new URL(url)).not.toThrow()
    })

    it("should handle Japanese characters", () => {
      const params = {
        ...baseParams,
        title: "かずみんとのセッション",
        description: "コーチングセッション予約",
      }

      const url = generateGoogleCalendarUrl(params)
      const parsedUrl = new URL(url)

      expect(parsedUrl.searchParams.get("text")).toBe("かずみんとのセッション")
      expect(parsedUrl.searchParams.get("details")).toBe("コーチングセッション予約")
    })

    it("should handle emojis", () => {
      const params = {
        ...baseParams,
        title: "ミーティング 📅",
      }

      const url = generateGoogleCalendarUrl(params)

      expect(() => new URL(url)).not.toThrow()
    })
  })

  describe("full URL generation", () => {
    it("should generate complete URL with all parameters", () => {
      const params = {
        title: "かずみんセッション",
        startTime: new Date("2024-06-15T10:00:00Z"),
        endTime: new Date("2024-06-15T11:00:00Z"),
        description: "Zoomでお会いしましょう",
        location: "https://zoom.us/j/123456789",
      }

      const url = generateGoogleCalendarUrl(params)
      const parsedUrl = new URL(url)

      expect(parsedUrl.origin + parsedUrl.pathname).toBe(
        "https://calendar.google.com/calendar/r/eventedit"
      )
      expect(parsedUrl.searchParams.get("text")).toBe("かずみんセッション")
      expect(parsedUrl.searchParams.get("dates")).toBe("20240615T100000Z/20240615T110000Z")
      expect(parsedUrl.searchParams.get("details")).toBe("Zoomでお会いしましょう")
      expect(parsedUrl.searchParams.get("location")).toBe("https://zoom.us/j/123456789")
    })
  })
})
