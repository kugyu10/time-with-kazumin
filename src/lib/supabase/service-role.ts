/**
 * Supabase Service Role Client
 *
 * RLSをバイパスするサーバーサイド専用クライアント。
 * ゲスト予約など、認証なしでDBアクセスが必要な場合に使用。
 */

import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// サーバーサイド専用チェック
if (typeof window !== "undefined") {
  throw new Error("service-role client must only be used on the server side")
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL environment variable")
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
}

export const supabaseServiceRole = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
