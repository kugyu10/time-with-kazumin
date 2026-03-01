import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  isZoomConfigured,
  createZoomMeeting,
  deleteZoomMeeting,
  clearTokenCache,
} from "@/lib/integrations/zoom"

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("Zoom Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearTokenCache()
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
