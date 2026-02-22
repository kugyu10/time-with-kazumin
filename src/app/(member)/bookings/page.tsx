import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { BookingTabs } from "@/components/bookings/BookingTabs"
import type { BookingCardData } from "@/components/bookings/BookingCard"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

// 予約データの型（Supabase結合クエリの結果）
type BookingRow = {
  id: number
  start_time: string
  end_time: string
  status: "confirmed" | "completed" | "canceled"
  member_plan_id: number
  meeting_menus: {
    name: string
    duration_minutes: number
    points_required: number
  } | null
}

export default async function BookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // 会員プランIDを取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberPlan } = await (supabase as any)
    .from("member_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single() as { data: { id: number } | null }

  if (!memberPlan) {
    // アクティブな会員プランがない場合
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">予約一覧</h1>
        <div className="text-center py-12 text-gray-500">
          <p>有効な会員プランがありません。</p>
        </div>
      </div>
    )
  }

  // 予約一覧を取得（RLS適用で本人の予約のみ）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bookings, error } = await (supabase as any)
    .from("bookings")
    .select(`
      id,
      start_time,
      end_time,
      status,
      member_plan_id,
      meeting_menus (
        name,
        duration_minutes,
        points_required
      )
    `)
    .eq("member_plan_id", memberPlan.id)
    .order("start_time", { ascending: true }) as {
      data: BookingRow[] | null
      error: Error | null
    }

  if (error) {
    console.error("Error fetching bookings:", error)
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">予約一覧</h1>
        <div className="text-center py-12 text-red-500">
          <p>予約の取得中にエラーが発生しました。</p>
        </div>
      </div>
    )
  }

  const allBookings: BookingCardData[] = (bookings ?? []).map((b) => ({
    id: b.id,
    start_time: b.start_time,
    end_time: b.end_time,
    status: b.status,
    meeting_menus: b.meeting_menus,
  }))

  const now = new Date()

  // 今後の予約（start_time >= now）- 近い順
  const upcomingBookings = allBookings
    .filter((b) => new Date(b.start_time) >= now && b.status !== "canceled")
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  // 過去の予約（start_time < now またはキャンセル済み）- 新しい順
  const pastBookings = allBookings
    .filter((b) => new Date(b.start_time) < now || b.status === "canceled")
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

  return (
    <div className="container mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">予約一覧</h1>
        <Link href="/bookings/new">
          <Button className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-2" />
            新規予約
          </Button>
        </Link>
      </div>

      {/* タブ切り替え */}
      <BookingTabs
        upcomingBookings={upcomingBookings}
        pastBookings={pastBookings}
      />
    </div>
  )
}
