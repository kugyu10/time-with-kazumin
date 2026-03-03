/**
 * 日本の祝日判定ユーティリティ
 *
 * 外部API: https://holidays-jp.github.io/api/v1/date.json
 * 1日1回キャッシュを使用
 */

// キャッシュの型定義
type HolidayCache = {
  data: Record<string, string>
  fetchedAt: number
}

// キャッシュ（1日有効）
let holidayCache: HolidayCache | null = null
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24時間

/**
 * 祝日データを取得（キャッシュ付き）
 */
async function fetchHolidays(): Promise<Record<string, string>> {
  const now = Date.now()

  // キャッシュが有効ならそれを返す
  if (holidayCache && now - holidayCache.fetchedAt < CACHE_TTL_MS) {
    return holidayCache.data
  }

  try {
    const response = await fetch(
      "https://holidays-jp.github.io/api/v1/date.json",
      {
        next: { revalidate: 86400 }, // Next.js: 1日キャッシュ
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch holidays: ${response.status}`)
    }

    const data: Record<string, string> = await response.json()

    // キャッシュを更新
    holidayCache = {
      data,
      fetchedAt: now,
    }

    return data
  } catch (error) {
    console.warn("[holidays] Failed to fetch holidays:", error)

    // キャッシュがあれば古くても返す
    if (holidayCache) {
      return holidayCache.data
    }

    // キャッシュもない場合は空オブジェクトを返す（平日扱い）
    return {}
  }
}

/**
 * 指定日が日本の祝日かどうかを判定
 * @param date YYYY-MM-DD形式の日付文字列
 * @returns 祝日ならtrue
 */
export async function isJapaneseHoliday(date: string): Promise<boolean> {
  const holidays = await fetchHolidays()
  return date in holidays
}

/**
 * 指定年の祝日一覧を取得
 * @param year 年（例: 2026）
 * @returns 日付をキー、祝日名を値としたオブジェクト
 */
export async function getHolidaysForYear(
  year: number
): Promise<Record<string, string>> {
  const holidays = await fetchHolidays()
  const yearStr = String(year)

  // 指定年の祝日のみフィルタリング
  const result: Record<string, string> = {}
  for (const [date, name] of Object.entries(holidays)) {
    if (date.startsWith(yearStr)) {
      result[date] = name
    }
  }

  return result
}

/**
 * 指定日の祝日名を取得
 * @param date YYYY-MM-DD形式の日付文字列
 * @returns 祝日名（祝日でなければnull）
 */
export async function getHolidayName(date: string): Promise<string | null> {
  const holidays = await fetchHolidays()
  return holidays[date] ?? null
}
