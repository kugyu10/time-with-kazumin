/**
 * cancelBooking() のユニットテスト
 *
 * テスト対象:
 * - 正常キャンセル（service role経由のstatus更新）
 * - UPDATEが0行に終わった場合のサイレント失敗検知
 * - 既にキャンセル済みの予約の拒否
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// 外部依存のモック
vi.mock("@/lib/integrations/zoom", () => ({
  deleteZoomMeeting: vi.fn(),
}))

vi.mock("@/lib/integrations/google-calendar", () => ({
  deleteCalendarEvent: vi.fn(),
}))

vi.mock("@/lib/integrations/email", () => ({
  sendBookingCancellationEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock("@/lib/utils/retry", () => ({
  retryWithExponentialBackoff: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
}))

// service role クライアントのモック（status更新に使用される）
const serviceRoleSelectFn = vi.fn()
vi.mock("@/lib/supabase/service-role", () => ({
  getSupabaseServiceRole: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: serviceRoleSelectFn,
        }),
      }),
    }),
  })),
}))

import { cancelBooking } from "../cancel"

const USER_ID = "user-123"

// 未来の予約日時（過去予約チェックを通過させる）
function futureISO(hoursAhead: number): string {
  return new Date(Date.now() + hoursAhead * 3600 * 1000).toISOString()
}

function createBookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    member_plan_id: 1,
    menu_id: 1,
    status: "confirmed",
    start_time: futureISO(24),
    end_time: futureISO(25),
    zoom_meeting_id: null,
    google_event_id: null,
    guest_email: null,
    guest_name: null,
    member_plans: { id: 1, user_id: USER_ID, current_points: 100 },
    meeting_menus: { name: "テストメニュー", points_required: 0, zoom_account: null },
    ...overrides,
  }
}

// キャンセル対象の予約取得＋profiles取得に応答するモッククライアント
function createMockSupabase(bookingRow: Record<string, unknown>) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: bookingRow, error: null }),
            }),
          }),
        }
      }
      // profiles
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { email: "member@example.com", full_name: "会員 太郎" },
              error: null,
            }),
          }),
        }),
      }
    }),
    rpc: vi.fn().mockResolvedValue({ data: 100, error: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe("cancelBooking()", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("Test 1: 正常にキャンセルできる（service roleで1行更新）", async () => {
    serviceRoleSelectFn.mockResolvedValue({ data: [{ id: 42 }], error: null })
    const supabase = createMockSupabase(createBookingRow())

    const result = await cancelBooking(42, supabase, USER_ID)

    expect(result.success).toBe(true)
  })

  it("Test 2: UPDATEが0行だった場合はstatus_update_failedを返す（サイレント失敗の検知）", async () => {
    serviceRoleSelectFn.mockResolvedValue({ data: [], error: null })
    const supabase = createMockSupabase(createBookingRow())

    const result = await cancelBooking(42, supabase, USER_ID)

    expect(result.success).toBe(false)
    expect(result.error_code).toBe("status_update_failed")
  })

  it("Test 3: UPDATEがエラーの場合はstatus_update_failedを返す", async () => {
    serviceRoleSelectFn.mockResolvedValue({ data: null, error: new Error("db error") })
    const supabase = createMockSupabase(createBookingRow())

    const result = await cancelBooking(42, supabase, USER_ID)

    expect(result.success).toBe(false)
    expect(result.error_code).toBe("status_update_failed")
  })

  it("Test 4: 既にキャンセル済みの予約はalready_canceledで拒否", async () => {
    const supabase = createMockSupabase(createBookingRow({ status: "canceled" }))

    const result = await cancelBooking(42, supabase, USER_ID)

    expect(result.success).toBe(false)
    expect(result.error_code).toBe("already_canceled")
  })

  it("Test 5: 他人の予約はforbiddenで拒否", async () => {
    const supabase = createMockSupabase(
      createBookingRow({ member_plans: { id: 1, user_id: "other-user", current_points: 0 } })
    )

    const result = await cancelBooking(42, supabase, USER_ID)

    expect(result.success).toBe(false)
    expect(result.error_code).toBe("forbidden")
  })
})
