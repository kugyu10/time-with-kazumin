/**
 * Supabase Service Role Client
 *
 * RLSをバイパスするサーバーサイド専用クライアント。
 * ゲスト予約など、認証なしでDBアクセスが必要な場合に使用。
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

let _supabaseServiceRole: SupabaseClient<Database> | null = null

/**
 * service_roleクライアントを取得
 * 遅延初期化でビルド時のエラーを回避
 */
export function getSupabaseServiceRole(): SupabaseClient<Database> {
  // サーバーサイド専用チェック
  if (typeof window !== "undefined") {
    throw new Error("service-role client must only be used on the server side")
  }

  if (_supabaseServiceRole) {
    return _supabaseServiceRole
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL environment variable")
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
  }

  _supabaseServiceRole = createClient<Database>(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  return _supabaseServiceRole
}

// 後方互換性のためのエイリアス
// 実際の使用時は getSupabaseServiceRole() を推奨
export { getSupabaseServiceRole as supabaseServiceRole }
