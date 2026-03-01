import { describe, it, expect, vi, beforeEach } from "vitest"
import { validateGuestBooking } from "@/lib/validation/guest"

// モック設定
vi.mock("@/lib/settings/app-settings", () => ({
  getBookingMinHoursAhead: vi.fn().mockResolvedValue(24),
}))

describe("validateGuestBooking", () => {
  // 未来の固定日時を使用（25時間後以降を確保）
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 7)
  const futureDateStr = futureDate.toISOString().split("T")[0]
  const futureStartTime = new Date(futureDate)
  futureStartTime.setHours(10, 0, 0, 0)
  const futureEndTime = new Date(futureDate)
  futureEndTime.setHours(11, 0, 0, 0)

  const validInput = {
    email: "test@example.com",
    name: "テスト太郎",
    slotDate: futureDateStr,
    startTime: futureStartTime.toISOString(),
    endTime: futureEndTime.toISOString(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("email validation", () => {
    it("should pass with valid email", async () => {
      const result = await validateGuestBooking(validInput)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should fail with empty email", async () => {
      const result = await validateGuestBooking({ ...validInput, email: "" })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("メールアドレスは必須です")
    })

    it("should fail with whitespace-only email", async () => {
      const result = await validateGuestBooking({ ...validInput, email: "   " })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("メールアドレスは必須です")
    })

    it("should fail with invalid email format", async () => {
      const result = await validateGuestBooking({ ...validInput, email: "invalid-email" })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("有効なメールアドレスを入力してください")
    })
  })

  describe("name validation", () => {
    it("should pass with valid name", async () => {
      const result = await validateGuestBooking({ ...validInput, name: "山田太郎" })
      expect(result.valid).toBe(true)
    })

    it("should fail with empty name", async () => {
      const result = await validateGuestBooking({ ...validInput, name: "" })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("お名前は必須です")
    })

    it("should fail with name shorter than 2 characters", async () => {
      const result = await validateGuestBooking({ ...validInput, name: "あ" })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("お名前は2文字以上で入力してください")
    })

    it("should fail with name longer than 100 characters", async () => {
      const longName = "あ".repeat(101)
      const result = await validateGuestBooking({ ...validInput, name: longName })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("お名前は100文字以内で入力してください")
    })

    it("should pass with exactly 2 characters", async () => {
      const result = await validateGuestBooking({ ...validInput, name: "太郎" })
      expect(result.valid).toBe(true)
    })

    it("should pass with exactly 100 characters", async () => {
      const name = "あ".repeat(100)
      const result = await validateGuestBooking({ ...validInput, name })
      expect(result.valid).toBe(true)
    })
  })

  describe("date validation", () => {
    it("should pass with valid date format", async () => {
      const result = await validateGuestBooking(validInput)
      expect(result.valid).toBe(true)
    })

    it("should fail with empty date", async () => {
      const result = await validateGuestBooking({ ...validInput, slotDate: "" })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("予約日は必須です")
    })

    it("should fail with invalid date format", async () => {
      const result = await validateGuestBooking({ ...validInput, slotDate: "2024/01/01" })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("予約日の形式が正しくありません")
    })
  })

  describe("time validation", () => {
    it("should fail with empty startTime", async () => {
      const result = await validateGuestBooking({ ...validInput, startTime: "" })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("開始時刻は必須です")
    })

    it("should fail with empty endTime", async () => {
      const result = await validateGuestBooking({ ...validInput, endTime: "" })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("終了時刻は必須です")
    })

    it("should fail with invalid startTime format", async () => {
      const result = await validateGuestBooking({ ...validInput, startTime: "10:00" })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("開始時刻の形式が正しくありません")
    })

    it("should fail when endTime is before startTime", async () => {
      const result = await validateGuestBooking({
        ...validInput,
        startTime: futureEndTime.toISOString(),
        endTime: futureStartTime.toISOString(),
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("終了時刻は開始時刻より後に設定してください")
    })

    it("should fail when startTime equals endTime", async () => {
      const result = await validateGuestBooking({
        ...validInput,
        startTime: futureStartTime.toISOString(),
        endTime: futureStartTime.toISOString(),
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("終了時刻は開始時刻より後に設定してください")
    })
  })

  describe("booking time restriction validation", () => {
    it("should fail when startTime is too soon (within 24 hours)", async () => {
      const soonDate = new Date()
      soonDate.setHours(soonDate.getHours() + 12) // 12時間後（24時間以内）
      const soonEndDate = new Date(soonDate)
      soonEndDate.setHours(soonEndDate.getHours() + 1)

      const result = await validateGuestBooking({
        ...validInput,
        slotDate: soonDate.toISOString().split("T")[0],
        startTime: soonDate.toISOString(),
        endTime: soonEndDate.toISOString(),
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("予約は24時間後以降の日時を選択してください")
    })

    it("should fail when startTime is in the past", async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      const pastEndDate = new Date(pastDate)
      pastEndDate.setHours(pastEndDate.getHours() + 1)

      const result = await validateGuestBooking({
        ...validInput,
        slotDate: pastDate.toISOString().split("T")[0],
        startTime: pastDate.toISOString(),
        endTime: pastEndDate.toISOString(),
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("予約は24時間後以降の日時を選択してください")
    })
  })

  describe("multiple errors", () => {
    it("should return all validation errors", async () => {
      const result = await validateGuestBooking({
        email: "",
        name: "",
        slotDate: "",
        startTime: "",
        endTime: "",
      })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(5)
    })
  })
})
