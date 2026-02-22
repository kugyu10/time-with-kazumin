/**
 * Google Calendar API Mock Implementation
 * Phase 4で本実装に置換予定
 */

export interface CalendarEventParams {
  summary: string
  start: string
  end: string
  description?: string
}

export interface CalendarEventResult {
  google_event_id: string
}

/**
 * Add an event to Google Calendar (MOCK)
 */
export async function addCalendarEvent(params: CalendarEventParams): Promise<CalendarEventResult> {
  console.log("[MOCK] Adding calendar event:", params)

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100))

  return {
    google_event_id: `mock-event-${Date.now()}`,
  }
}

/**
 * Delete an event from Google Calendar (MOCK)
 */
export async function deleteCalendarEvent(eventId: string): Promise<{ success: boolean }> {
  console.log("[MOCK] Deleting calendar event:", eventId)

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 50))

  return { success: true }
}
