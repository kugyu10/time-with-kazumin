/**
 * Guest Booking Page
 *
 * ゲスト予約フローUI
 * スロット選択 + 情報入力 + 送信
 */

import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { GuestBookingClient } from "./GuestBookingClient"

// 動的レンダリングを強制（ビルド時の静的生成を防止）
export const dynamic = "force-dynamic"

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables")
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

export default async function GuestBookingPage() {
  const supabase = getSupabase()

  // weekly_schedulesを取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: schedules, error } = await (supabase as any)
    .from("weekly_schedules")
    .select("day_of_week, start_time, end_time") as {
      data: Array<{ day_of_week: number; start_time: string; end_time: string }> | null
      error: { message: string } | null
    }

  if (error) {
    console.error("[GuestBookingPage] Schedule error:", error)
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg bg-red-50 p-4">
          <p className="text-red-700">スケジュールの取得に失敗しました</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          カジュアル30分セッション予約
        </h1>
        <p className="mt-2 text-gray-600">
          かずみんと気軽にお話しできる30分間のセッションです。会員登録不要でご予約いただけます。
        </p>
      </div>

      <GuestBookingClient schedules={schedules || []} />
    </div>
  )
}
