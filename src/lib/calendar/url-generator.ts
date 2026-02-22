/**
 * Google Calendar URL Generator
 *
 * ゲストが1クリックでGoogleカレンダーに予約を追加できるURL生成
 */

interface CalendarUrlParams {
  title: string
  startTime: Date
  endTime: Date
  description?: string
  location?: string
}

/**
 * 日時をGoogle Calendar形式に変換
 * @param date Date オブジェクト
 * @returns YYYYMMDDTHHMMSSZ 形式
 */
function formatDateForGoogleCalendar(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

/**
 * Google Calendar イベント作成URLを生成
 * @param params タイトル、開始/終了時刻、説明、場所
 * @returns Google Calendar URL
 */
export function generateGoogleCalendarUrl(params: CalendarUrlParams): string {
  const { title, startTime, endTime, description, location } = params

  const formattedStart = formatDateForGoogleCalendar(startTime)
  const formattedEnd = formatDateForGoogleCalendar(endTime)

  const url = new URL("https://calendar.google.com/calendar/r/eventedit")

  url.searchParams.set("text", title)
  url.searchParams.set("dates", `${formattedStart}/${formattedEnd}`)

  if (description) {
    url.searchParams.set("details", description)
  }

  if (location) {
    url.searchParams.set("location", location)
  }

  return url.toString()
}
