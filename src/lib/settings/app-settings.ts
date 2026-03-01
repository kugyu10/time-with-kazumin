/**
 * App Settings Helper
 *
 * アプリ設定の取得・更新を行うユーティリティ
 * service roleを使用してRLSをバイパス
 */

import { getSupabaseServiceRole } from "@/lib/supabase/service-role"

// 設定キーの定義
export const SETTING_KEYS = {
  BOOKING_MIN_HOURS_AHEAD: "booking_min_hours_ahead",
} as const

// デフォルト値の定義
const DEFAULT_VALUES: Record<string, string> = {
  [SETTING_KEYS.BOOKING_MIN_HOURS_AHEAD]: "24",
}

/**
 * アプリ設定を取得
 */
export async function getAppSetting(key: string): Promise<string | null> {
  try {
    const supabase = getSupabaseServiceRole()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .single() as { data: { value: string | null } | null; error: { message: string } | null }

    if (error) {
      // PGRST116 = row not found
      if (error.message.includes("PGRST116")) {
        return DEFAULT_VALUES[key] || null
      }
      console.error(`[AppSettings] Failed to get ${key}:`, error)
      return DEFAULT_VALUES[key] || null
    }

    return data?.value ?? DEFAULT_VALUES[key] ?? null
  } catch (error) {
    console.error(`[AppSettings] Error getting ${key}:`, error)
    return DEFAULT_VALUES[key] || null
  }
}

/**
 * 予約可能最小時間（時間）を取得
 */
export async function getBookingMinHoursAhead(): Promise<number> {
  const value = await getAppSetting(SETTING_KEYS.BOOKING_MIN_HOURS_AHEAD)
  const parsed = Number(value)
  return isNaN(parsed) ? 24 : parsed
}

/**
 * アプリ設定を更新（管理者用）
 */
export async function setAppSetting(key: string, value: string): Promise<boolean> {
  try {
    const supabase = getSupabaseServiceRole()

    // upsertを使用
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("app_settings")
      .upsert({ key, value }, { onConflict: "key" }) as { error: { message: string } | null }

    if (error) {
      console.error(`[AppSettings] Failed to set ${key}:`, error)
      return false
    }

    return true
  } catch (error) {
    console.error(`[AppSettings] Error setting ${key}:`, error)
    return false
  }
}

/**
 * 複数のアプリ設定を一括取得
 */
export async function getAppSettings(keys: string[]): Promise<Record<string, string | null>> {
  try {
    const supabase = getSupabaseServiceRole()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("app_settings")
      .select("key, value")
      .in("key", keys) as { data: Array<{ key: string; value: string | null }> | null; error: { message: string } | null }

    if (error) {
      console.error("[AppSettings] Failed to get multiple settings:", error)
      // デフォルト値を返す
      return keys.reduce((acc, key) => {
        acc[key] = DEFAULT_VALUES[key] || null
        return acc
      }, {} as Record<string, string | null>)
    }

    // 結果をマップに変換し、デフォルト値で補完
    const result: Record<string, string | null> = {}
    for (const key of keys) {
      const found = data?.find(d => d.key === key)
      result[key] = found?.value ?? DEFAULT_VALUES[key] ?? null
    }

    return result
  } catch (error) {
    console.error("[AppSettings] Error getting multiple settings:", error)
    return keys.reduce((acc, key) => {
      acc[key] = DEFAULT_VALUES[key] || null
      return acc
    }, {} as Record<string, string | null>)
  }
}
