/**
 * Google Calendar API Implementation
 * Phase 4: Google Calendar統合
 *
 * FreeBusy APIでbusy時間を取得し、空きスロット計算に使用
 * Events APIでカレンダーイベントの追加/削除
 */

import { google, calendar_v3 } from "googleapis"
import { LRUCache } from "lru-cache"
import { getOAuthClient, isAuthenticated } from "./oauth/google"
import { retryWithExponentialBackoff } from "@/lib/utils/retry"

// Calendar ID（環境変数で指定可能、デフォルトはprimary）
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary"
const TIMEZONE = "Asia/Tokyo"

// Busy times cache: 15分TTL
const busyTimesCache = new LRUCache<string, BusyTime[]>({
  max: 100,
  ttl: 15 * 60 * 1000, // 15分
})

export interface CalendarEventParams {
  summary: string
  start: string
  end: string
  description?: string
}

export interface CalendarEventResult {
  google_event_id: string
}

export interface BusyTime {
  start: string
  end: string
}

/**
 * Google Calendarクライアントを取得
 */
async function getCalendarClient(): Promise<calendar_v3.Calendar | null> {
  const oauth2Client = await getOAuthClient()
  if (!oauth2Client) {
    console.warn("[GoogleCalendar] OAuth client not available")
    return null
  }
  return google.calendar({ version: "v3", auth: oauth2Client })
}

/**
 * 管理者のbusy時間を取得（FreeBusy API）
 */
export async function getAdminBusyTimes(
  startDate: string,
  endDate: string
): Promise<BusyTime[]> {
  const calendar = await getCalendarClient()
  if (!calendar) {
    console.warn("[GoogleCalendar] Cannot get busy times: no calendar client")
    return []
  }

  try {
    const response = await retryWithExponentialBackoff(async () => {
      return calendar.freebusy.query({
        requestBody: {
          timeMin: startDate,
          timeMax: endDate,
          timeZone: TIMEZONE,
          items: [{ id: GOOGLE_CALENDAR_ID }],
        },
      })
    })

    const busySlots =
      response.data.calendars?.[GOOGLE_CALENDAR_ID]?.busy || []

    console.log(
      `[GoogleCalendar] Retrieved ${busySlots.length} busy slots for ${startDate} to ${endDate}`
    )

    return busySlots.map((slot) => ({
      start: slot.start || "",
      end: slot.end || "",
    }))
  } catch (error) {
    console.error("[GoogleCalendar] Failed to get busy times:", error)
    // エラー時は空配列を返す（予約は可能にする）
    return []
  }
}

/**
 * busy時間をキャッシュ付きで取得
 * 15分間キャッシュしてAPI呼び出しを削減
 */
export async function getCachedBusyTimes(
  startDate: string,
  endDate: string
): Promise<BusyTime[]> {
  // OAuthトークンが設定されていない場合はスキップ
  const isAuth = await isAuthenticated()
  if (!isAuth) {
    console.warn(
      "[GoogleCalendar] OAuth not configured, skipping busy times check"
    )
    return []
  }

  const cacheKey = `${startDate}-${endDate}`
  const cached = busyTimesCache.get(cacheKey)

  if (cached) {
    console.log("[GoogleCalendar] Using cached busy times")
    return cached
  }

  const busyTimes = await getAdminBusyTimes(startDate, endDate)
  busyTimesCache.set(cacheKey, busyTimes)

  return busyTimes
}

/**
 * カレンダーにイベントを追加
 */
export async function addCalendarEvent(
  params: CalendarEventParams
): Promise<CalendarEventResult> {
  const calendar = await getCalendarClient()

  // OAuthが設定されていない場合はモック動作
  if (!calendar) {
    console.log("[GoogleCalendar] OAuth not configured, using mock")
    return {
      google_event_id: `mock-event-${Date.now()}`,
    }
  }

  try {
    const response = await retryWithExponentialBackoff(async () => {
      return calendar.events.insert({
        calendarId: GOOGLE_CALENDAR_ID,
        requestBody: {
          summary: params.summary,
          description: params.description,
          start: {
            dateTime: params.start,
            timeZone: TIMEZONE,
          },
          end: {
            dateTime: params.end,
            timeZone: TIMEZONE,
          },
        },
      })
    })

    const eventId = response.data.id

    if (!eventId) {
      throw new Error("Failed to create calendar event: no event ID returned")
    }

    console.log(`[GoogleCalendar] Event created: ${eventId}`)

    return {
      google_event_id: eventId,
    }
  } catch (error) {
    console.error("[GoogleCalendar] Failed to add event:", error)
    throw error
  }
}

/**
 * カレンダーからイベントを削除
 */
export async function deleteCalendarEvent(
  eventId: string
): Promise<{ success: boolean }> {
  const calendar = await getCalendarClient()

  // OAuthが設定されていない場合はモック動作
  if (!calendar) {
    console.log("[GoogleCalendar] OAuth not configured, using mock")
    return { success: true }
  }

  // モックイベントIDの場合はスキップ
  if (eventId.startsWith("mock-event-")) {
    console.log("[GoogleCalendar] Skipping mock event deletion")
    return { success: true }
  }

  try {
    await retryWithExponentialBackoff(async () => {
      return calendar.events.delete({
        calendarId: GOOGLE_CALENDAR_ID,
        eventId: eventId,
      })
    })

    console.log(`[GoogleCalendar] Event deleted: ${eventId}`)

    return { success: true }
  } catch (error) {
    console.error("[GoogleCalendar] Failed to delete event:", error)
    throw error
  }
}

/**
 * キャッシュをクリア（テスト用）
 */
export function clearBusyTimesCache(): void {
  busyTimesCache.clear()
  console.log("[GoogleCalendar] Busy times cache cleared")
}
