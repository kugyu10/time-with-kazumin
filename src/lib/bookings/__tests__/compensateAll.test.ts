/**
 * compensateAll() のユニットテスト
 *
 * テスト対象:
 * - completedSteps配列の非破壊的逆順実行
 * - 補償失敗の収集（全ステップ最後まで実行）
 * - BookingSagaResultへの補償失敗情報の伝播
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import type { BookingSagaContext } from "../types"

// 外部依存のモック
vi.mock("@/lib/integrations/zoom", () => ({
  createZoomMeeting: vi.fn(),
  deleteZoomMeeting: vi.fn(),
  getZoomScheduledMeetings: vi.fn(),
}))

vi.mock("@/lib/integrations/google-calendar", () => ({
  addCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn(),
}))

vi.mock("@/lib/integrations/email", () => ({
  sendBookingConfirmationEmail: vi.fn(),
}))

vi.mock("@/lib/tokens/cancel-token", () => ({
  generateCancelToken: vi.fn().mockResolvedValue("mock-token"),
}))

vi.mock("@/lib/utils/retry", () => ({
  retryWithExponentialBackoff: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
}))

import { deleteZoomMeeting } from "@/lib/integrations/zoom"
import { deleteCalendarEvent } from "@/lib/integrations/google-calendar"
import { _compensateAllForTest } from "../saga"

// モック Supabase クライアント
function createMockSupabase(options: {
  rpcResult?: { error: null | Error }
  updateResult?: { error: null | Error }
} = {}) {
  const rpcFn = vi.fn().mockResolvedValue(options.rpcResult ?? { error: null })
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue(options.updateResult ?? { error: null }),
  })

  return {
    rpc: rpcFn,
    from: vi.fn().mockReturnValue({
      update: updateFn,
    }),
  } as unknown as Parameters<typeof _compensateAllForTest>[0]
}

// テスト用コンテキスト作成ヘルパー
function createContext(overrides: Partial<BookingSagaContext> = {}): BookingSagaContext {
  return {
    request: {
      member_plan_id: 1,
      menu_id: 1,
      start_time: "2026-04-01T10:00:00Z",
      end_time: "2026-04-01T11:00:00Z",
    },
    userId: "user-123",
    memberPlanId: 1,
    menuId: 1,
    menuName: "コーチングセッション",
    menuDuration: 60,
    pointsRequired: 10,
    startTime: "2026-04-01T10:00:00Z",
    endTime: "2026-04-01T11:00:00Z",
    pointsConsumed: true,
    bookingId: 42,
    zoomMeetingId: "zoom-meeting-id-123",
    zoomJoinUrl: "https://zoom.us/j/123",
    zoomStartUrl: "https://zoom.us/s/123",
    zoomAccountType: "A",
    googleEventId: "google-event-id-456",
    ...overrides,
  }
}

describe("compensateAll()", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(deleteZoomMeeting).mockResolvedValue(undefined as never)
    vi.mocked(deleteCalendarEvent).mockResolvedValue(undefined as never)
  })

  it("Test 1: completedSteps配列を変更しない（非破壊的逆順）", async () => {
    const supabase = createMockSupabase()
    const context = createContext()
    const completedSteps = ["consume_points", "create_booking", "create_zoom", "add_calendar"]
    const originalOrder = [...completedSteps]

    await _compensateAllForTest(supabase, context, completedSteps)

    // 元の配列の順序が変わっていないこと
    expect(completedSteps).toEqual(originalOrder)
  })

  it("Test 2: 全補償が成功した場合、空のCompensationFailure[]を返す", async () => {
    const supabase = createMockSupabase()
    const context = createContext()
    const completedSteps = ["consume_points", "create_booking", "create_zoom", "add_calendar"]

    const failures = await _compensateAllForTest(supabase, context, completedSteps)

    expect(failures).toEqual([])
  })

  it("Test 3: Zoom削除が失敗しても他の補償ステップは実行される", async () => {
    const supabase = createMockSupabase()
    const context = createContext()
    const completedSteps = ["consume_points", "create_booking", "create_zoom", "add_calendar"]

    // Zoom削除を失敗させる
    vi.mocked(deleteZoomMeeting).mockRejectedValueOnce(new Error("Zoom API error"))

    const failures = await _compensateAllForTest(supabase, context, completedSteps)

    // Zoom削除失敗が収集される
    expect(failures.length).toBeGreaterThan(0)
    expect(failures.some(f => f.step === "create_zoom")).toBe(true)

    // Calendar削除は実行される（deleteCalendarEventが呼ばれる）
    expect(deleteCalendarEvent).toHaveBeenCalled()

    // Supabase update（booking cancel）が呼ばれる
    expect(supabase.from).toHaveBeenCalledWith("bookings")
  })

  it("Test 4: 複数の補償が失敗した場合、全ての失敗がCompensationFailure[]に収集される", async () => {
    const supabase = createMockSupabase()
    const context = createContext()
    const completedSteps = ["consume_points", "create_booking", "create_zoom", "add_calendar"]

    // ZoomとCalendar両方を失敗させる
    vi.mocked(deleteZoomMeeting).mockRejectedValueOnce(new Error("Zoom API error"))
    vi.mocked(deleteCalendarEvent).mockRejectedValueOnce(new Error("Calendar API error"))

    const failures = await _compensateAllForTest(supabase, context, completedSteps)

    // 2つの失敗が収集される
    expect(failures.length).toBe(2)
    expect(failures.some(f => f.step === "create_zoom")).toBe(true)
    expect(failures.some(f => f.step === "add_calendar")).toBe(true)
    // 各失敗にerrorメッセージが含まれる
    failures.forEach(f => {
      expect(f.error).toBeTruthy()
      expect(typeof f.error).toBe("string")
    })
  })
})
