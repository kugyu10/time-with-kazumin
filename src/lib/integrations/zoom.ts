/**
 * Zoom Server-to-Server OAuth Integration
 * Supports multiple Zoom accounts (A and B) for meeting creation
 */

import { LRUCache } from "lru-cache"

type AccountType = "A" | "B"

export interface ZoomMeetingParams {
  topic: string
  start_time: string
  duration: number
  accountType: AccountType
}

export interface ZoomMeetingResult {
  zoom_meeting_id: string
  zoom_join_url: string
  zoom_start_url: string
}

interface ZoomTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface ZoomMeetingResponse {
  id: number
  join_url: string
  start_url: string
}

// LRU Cache for access tokens: 2 entries (A, B), ~1 hour TTL (3500s to be safe)
const tokenCache = new LRUCache<string, string>({
  max: 2,
  ttl: 3500 * 1000, // ~1 hour minus 100 second buffer
})

/**
 * Get Zoom account credentials from environment
 */
function getAccountCredentials(accountType: AccountType): {
  accountId: string
  clientId: string
  clientSecret: string
} | null {
  const prefix = `ZOOM_ACCOUNT_${accountType}`
  const accountId = process.env[`${prefix}_ACCOUNT_ID`]
  const clientId = process.env[`${prefix}_CLIENT_ID`]
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]

  if (!accountId || !clientId || !clientSecret) {
    return null
  }

  return { accountId, clientId, clientSecret }
}

/**
 * Check if Zoom credentials are configured
 */
export function isZoomConfigured(accountType: AccountType = "A"): boolean {
  return getAccountCredentials(accountType) !== null
}

/**
 * Get access token for specified Zoom account (Server-to-Server OAuth)
 */
export async function getZoomAccessToken(accountType: AccountType): Promise<string> {
  // Check cache first
  const cachedToken = tokenCache.get(accountType)
  if (cachedToken) {
    console.log(`[Zoom] Using cached token for account ${accountType}`)
    return cachedToken
  }

  const credentials = getAccountCredentials(accountType)
  if (!credentials) {
    throw new Error(`Zoom account ${accountType} credentials not configured`)
  }

  console.log(`[Zoom] Fetching new access token for account ${accountType}`)

  const { accountId, clientId, clientSecret } = credentials
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "account_credentials",
      account_id: accountId,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Zoom] Token fetch failed: ${response.status}`, errorText)
    throw new Error(`Failed to get Zoom access token: ${response.status}`)
  }

  const data: ZoomTokenResponse = await response.json()

  // Cache the token
  tokenCache.set(accountType, data.access_token)

  return data.access_token
}

/**
 * Create a Zoom meeting
 */
export async function createZoomMeeting(
  params: ZoomMeetingParams
): Promise<ZoomMeetingResult> {
  const { topic, start_time, duration, accountType } = params

  // Check if Zoom is configured
  if (!isZoomConfigured(accountType)) {
    console.warn(`[Zoom] Account ${accountType} not configured, using mock`)
    const mockId = `mock-${Date.now()}`
    return {
      zoom_meeting_id: mockId,
      zoom_join_url: `https://zoom.us/j/${mockId}`,
      zoom_start_url: `https://zoom.us/s/${mockId}`,
    }
  }

  const accessToken = await getZoomAccessToken(accountType)

  console.log(`[Zoom] Creating meeting with account ${accountType}:`, topic)

  const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic,
      type: 2, // Scheduled meeting
      start_time,
      duration,
      timezone: "Asia/Tokyo",
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: false,
        waiting_room: true,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Zoom] Meeting creation failed: ${response.status}`, errorText)
    throw new Error(`Failed to create Zoom meeting: ${response.status}`)
  }

  const data: ZoomMeetingResponse = await response.json()

  console.log(`[Zoom] Meeting created: ${data.id}`)

  return {
    zoom_meeting_id: String(data.id),
    zoom_join_url: data.join_url,
    zoom_start_url: data.start_url,
  }
}

/**
 * Delete a Zoom meeting
 * Since we don't store which account created the meeting,
 * we try both accounts (or use bookings table zoom_account if available)
 */
export async function deleteZoomMeeting(
  meetingId: string,
  accountType?: AccountType
): Promise<{ success: boolean }> {
  // Skip mock meetings
  if (meetingId.startsWith("mock-")) {
    console.log(`[Zoom] Skipping mock meeting deletion: ${meetingId}`)
    return { success: true }
  }

  // If accountType is provided, try that account first
  if (accountType && isZoomConfigured(accountType)) {
    const result = await tryDeleteMeeting(meetingId, accountType)
    if (result) return { success: true }
  }

  // Try both accounts
  const accountsToTry: AccountType[] = accountType
    ? [accountType === "A" ? "B" : "A"]
    : ["A", "B"]

  for (const account of accountsToTry) {
    if (!isZoomConfigured(account)) continue

    const result = await tryDeleteMeeting(meetingId, account)
    if (result) return { success: true }
  }

  console.warn(`[Zoom] Meeting ${meetingId} not found on any account`)
  return { success: false }
}

/**
 * Helper: Try to delete meeting with specific account
 */
async function tryDeleteMeeting(
  meetingId: string,
  accountType: AccountType
): Promise<boolean> {
  try {
    const accessToken = await getZoomAccessToken(accountType)

    const response = await fetch(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (response.ok || response.status === 204) {
      console.log(`[Zoom] Meeting ${meetingId} deleted via account ${accountType}`)
      return true
    }

    // 404 means meeting doesn't exist on this account
    if (response.status === 404) {
      return false
    }

    console.warn(
      `[Zoom] Failed to delete meeting ${meetingId} via account ${accountType}: ${response.status}`
    )
    return false
  } catch (error) {
    console.error(`[Zoom] Error deleting meeting:`, error)
    return false
  }
}

/**
 * Clear token cache (for testing)
 */
export function clearTokenCache(): void {
  tokenCache.clear()
  console.log("[Zoom] Token cache cleared")
}
