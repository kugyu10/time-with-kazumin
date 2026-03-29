import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  isZoomConfigured,
  createZoomMeeting,
  deleteZoomMeeting,
  clearTokenCache,
  getZoomScheduledMeetings,
  getCachedZoomBusyTimes,
  clearZoomScheduleCache,
} from "@/lib/integrations/zoom"

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("Zoom Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearTokenCache()
    clearZoomScheduleCache()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("isZoomConfigured", () => {
    it("should return false when credentials are not set", () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "")

      expect(isZoomConfigured("A")).toBe(false)
    })

    it("should return true when all credentials are set", () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")

      expect(isZoomConfigured("A")).toBe(true)
    })

    it("should check correct account type", () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "a-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "a-client")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "a-secret")
      vi.stubEnv("ZOOM_ACCOUNT_B_ACCOUNT_ID", "")

      expect(isZoomConfigured("A")).toBe(true)
      expect(isZoomConfigured("B")).toBe(false)
    })
  })

  describe("createZoomMeeting", () => {
    it("should return mock meeting when not configured", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "")

      const result = await createZoomMeeting({
        topic: "Test Meeting",
        start_time: "2024-06-15T10:00:00Z",
        duration: 60,
        accountType: "A",
      })

      expect(result.zoom_meeting_id).toMatch(/^mock-/)
      expect(result.zoom_join_url).toContain("zoom.us/j/mock-")
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("should create meeting when configured", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")

      // Mock token fetch
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "test-access-token",
              token_type: "bearer",
              expires_in: 3600,
            }),
        })
        // Mock meeting creation
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 123456789,
              join_url: "https://zoom.us/j/123456789",
              start_url: "https://zoom.us/s/123456789",
            }),
        })

      const result = await createZoomMeeting({
        topic: "Test Meeting",
        start_time: "2024-06-15T10:00:00Z",
        duration: 60,
        accountType: "A",
      })

      expect(result.zoom_meeting_id).toBe("123456789")
      expect(result.zoom_join_url).toBe("https://zoom.us/j/123456789")
      expect(result.zoom_start_url).toBe("https://zoom.us/s/123456789")
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it("should throw error when token fetch fails", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      })

      await expect(
        createZoomMeeting({
          topic: "Test Meeting",
          start_time: "2024-06-15T10:00:00Z",
          duration: 60,
          accountType: "A",
        })
      ).rejects.toThrow("Failed to get Zoom access token: 401")
    })

    it("should throw error when meeting creation fails", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "test-access-token",
              token_type: "bearer",
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () => Promise.resolve("Bad Request"),
        })

      await expect(
        createZoomMeeting({
          topic: "Test Meeting",
          start_time: "2024-06-15T10:00:00Z",
          duration: 60,
          accountType: "A",
        })
      ).rejects.toThrow("Failed to create Zoom meeting: 400")
    })
  })

  describe("deleteZoomMeeting", () => {
    it("should skip mock meetings", async () => {
      const result = await deleteZoomMeeting("mock-12345")

      expect(result.success).toBe(true)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("should call account A API when accountType A is specified", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id-a")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id-a")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret-a")

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "test-access-token-a",
              token_type: "bearer",
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        })

      const result = await deleteZoomMeeting("meeting-123", "A")

      expect(result.success).toBe(true)
      // アカウントAのトークンエンドポイントが呼ばれたことを確認
      expect(mockFetch).toHaveBeenCalledWith(
        "https://zoom.us/oauth/token",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Basic "),
          }),
        })
      )
    })

    it("should try account A then B when accountType is not specified", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id-a")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id-a")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret-a")
      vi.stubEnv("ZOOM_ACCOUNT_B_ACCOUNT_ID", "account-id-b")
      vi.stubEnv("ZOOM_ACCOUNT_B_CLIENT_ID", "client-id-b")
      vi.stubEnv("ZOOM_ACCOUNT_B_CLIENT_SECRET", "client-secret-b")

      mockFetch
        // アカウントAのトークン取得
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "token-a",
              token_type: "bearer",
              expires_in: 3600,
            }),
        })
        // アカウントAでの削除 → 404（見つからない）
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        // アカウントBのトークン取得
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "token-b",
              token_type: "bearer",
              expires_in: 3600,
            }),
        })
        // アカウントBでの削除 → 成功
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        })

      const result = await deleteZoomMeeting("meeting-123")

      expect(result.success).toBe(true)
      // A→Bの順でfetchが4回呼ばれること（トークン×2 + 削除×2）
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })

    it("should return success true on 204 response", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "test-access-token",
              token_type: "bearer",
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        })

      const result = await deleteZoomMeeting("meeting-456", "A")

      expect(result.success).toBe(true)
    })

    it("should delete meeting successfully", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "test-access-token",
              token_type: "bearer",
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        })

      const result = await deleteZoomMeeting("123456789", "A")

      expect(result.success).toBe(true)
    })

    it("should return false when meeting not found on any account", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")
      vi.stubEnv("ZOOM_ACCOUNT_B_ACCOUNT_ID", "")

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "test-access-token",
              token_type: "bearer",
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })

      const result = await deleteZoomMeeting("nonexistent", "A")

      expect(result.success).toBe(false)
    })
  })

  describe("getZoomScheduledMeetings", () => {
    const FROM = "2026-04-01T00:00:00Z"
    const TO = "2026-04-07T23:59:59Z"

    it("should return empty array when account is not configured", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "")

      const result = await getZoomScheduledMeetings("A", FROM, TO)

      expect(result).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("should convert Zoom meetings to BusyTime[]", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "test-token", token_type: "bearer", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              page_count: 1,
              page_size: 30,
              total_records: 1,
              next_page_token: "",
              meetings: [
                {
                  id: 1,
                  uuid: "abc",
                  topic: "Test Meeting",
                  type: 2,
                  start_time: "2026-04-01T01:00:00Z",
                  duration: 60,
                  timezone: "Asia/Tokyo",
                  status: "waiting",
                },
              ],
            }),
        })

      const result = await getZoomScheduledMeetings("A", FROM, TO)

      expect(result).toEqual([{ start: "2026-04-01T01:00:00.000Z", end: "2026-04-01T02:00:00.000Z" }])
    })

    it("should return empty array on error 3161 response", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "test-token", token_type: "bearer", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ code: 3161, message: "Meeting hosting capability is blocked." }),
        })

      const result = await getZoomScheduledMeetings("A", FROM, TO)

      expect(result).toEqual([])
    })

    it("should return empty array when fetch throws", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "test-token", token_type: "bearer", expires_in: 3600 }),
        })
        .mockRejectedValueOnce(new Error("network error"))

      const result = await getZoomScheduledMeetings("A", FROM, TO)

      expect(result).toEqual([])
    })

    it("should always call API without caching (cache bypass for booking confirmation per D-07)", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")

      const meetingsResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            page_count: 1,
            page_size: 30,
            total_records: 0,
            next_page_token: "",
            meetings: [],
          }),
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "token-1", token_type: "bearer", expires_in: 3600 }),
        })
        .mockResolvedValueOnce(meetingsResponse)
        .mockResolvedValueOnce(meetingsResponse)

      await getZoomScheduledMeetings("A", FROM, TO)
      await getZoomScheduledMeetings("A", FROM, TO)

      // token取得1回（キャッシュ済み） + meetings取得2回 = 3回
      // スケジュールキャッシュはバイパスされるため、meetingsエンドポイントは毎回呼ばれる
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  describe("getCachedZoomBusyTimes", () => {
    const START = "2026-04-01T00:00:00Z"
    const END = "2026-04-07T23:59:59Z"

    it("should return cached result on second call (fetch called once for meetings)", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "test-token", token_type: "bearer", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              page_count: 1,
              page_size: 30,
              total_records: 0,
              next_page_token: "",
              meetings: [],
            }),
        })

      await getCachedZoomBusyTimes("A", START, END)
      const result = await getCachedZoomBusyTimes("A", START, END)

      expect(result).toEqual([])
      // token取得1回 + meetings取得1回 = 2回（2回目はキャッシュ）
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it("should re-fetch after clearZoomScheduleCache()", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")

      const emptyMeetings = {
        ok: true,
        json: () =>
          Promise.resolve({
            page_count: 1,
            page_size: 30,
            total_records: 0,
            next_page_token: "",
            meetings: [],
          }),
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "token-1", token_type: "bearer", expires_in: 3600 }),
        })
        .mockResolvedValueOnce(emptyMeetings)
        .mockResolvedValueOnce(emptyMeetings)

      await getCachedZoomBusyTimes("A", START, END)
      clearZoomScheduleCache()
      await getCachedZoomBusyTimes("A", START, END)

      // キャッシュクリア後に再取得: token×1（キャッシュ済み） + meetings×2 = 3回
      // スケジュールキャッシュがクリアされたためmeetings APIは再呼び出しされる
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  describe("token caching", () => {
    it("should cache access token", async () => {
      vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
      vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")

      // Mock token fetch and meeting creation
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "cached-token",
              token_type: "bearer",
              expires_in: 3600,
            }),
        })
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 1,
              join_url: "https://zoom.us/j/1",
              start_url: "https://zoom.us/s/1",
            }),
        })

      // First call - should fetch token
      await createZoomMeeting({
        topic: "Meeting 1",
        start_time: "2024-06-15T10:00:00Z",
        duration: 60,
        accountType: "A",
      })

      // Second call - should use cached token
      await createZoomMeeting({
        topic: "Meeting 2",
        start_time: "2024-06-15T11:00:00Z",
        duration: 60,
        accountType: "A",
      })

      // Token fetch should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(3) // 1 token + 2 meetings
    })
  })
})
