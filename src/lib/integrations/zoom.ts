/**
 * Zoom API Mock Implementation
 * Phase 4で本実装に置換予定
 */

export interface ZoomMeetingParams {
  topic: string
  start_time: string
  duration: number
}

export interface ZoomMeetingResult {
  zoom_meeting_id: string
  zoom_join_url: string
}

/**
 * Create a Zoom meeting (MOCK)
 */
export async function createZoomMeeting(params: ZoomMeetingParams): Promise<ZoomMeetingResult> {
  console.log("[MOCK] Creating Zoom meeting:", params)

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100))

  const mockId = `mock-${Date.now()}`
  return {
    zoom_meeting_id: mockId,
    zoom_join_url: `https://zoom.us/j/${mockId}`,
  }
}

/**
 * Delete a Zoom meeting (MOCK)
 */
export async function deleteZoomMeeting(meetingId: string): Promise<{ success: boolean }> {
  console.log("[MOCK] Deleting Zoom meeting:", meetingId)

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 50))

  return { success: true }
}
