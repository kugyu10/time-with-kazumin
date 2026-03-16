import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Calendar, Video, ArrowRight } from "lucide-react"
import Link from "next/link"

type SearchParams = Promise<{ bookingId?: string }>

export default async function BookingCompletePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const params = await searchParams
  const bookingId = params.bookingId ? parseInt(params.bookingId, 10) : null

  // 予約詳細の型
  type BookingComplete = {
    id: number
    start_time: string
    zoom_join_url: string | null
    meeting_menus: { name: string } | null
  }

  // 予約詳細を取得（bookingIdがある場合）
  let booking: BookingComplete | null = null

  if (bookingId && !isNaN(bookingId)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("bookings")
      .select(`
        id,
        start_time,
        zoom_join_url,
        meeting_menus (
          name
        )
      `)
      .eq("id", bookingId)
      .single() as { data: BookingComplete | null }

    booking = data
  }

  // 日時のフォーマット
  function formatDateTime(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      timeZone: "Asia/Tokyo",
    }) + " " + date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Tokyo",
    })
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
      <Card>
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          {/* 成功アイコン */}
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
          </div>

          {/* メッセージ */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">
              予約が完了しました
            </h1>
            <p className="text-gray-600">
              かずみんとのセッションを楽しみにしていてくださいね
            </p>
          </div>

          {/* 予約詳細 */}
          {booking && (
            <div className="bg-gray-50 rounded-lg p-4 text-left space-y-3">
              {booking.meeting_menus && (
                <div className="font-medium text-gray-900">
                  {booking.meeting_menus.name}
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>{formatDateTime(booking.start_time)}</span>
              </div>
              {booking.zoom_join_url && (
                <div className="flex items-start gap-2 text-gray-600">
                  <Video className="h-4 w-4 mt-0.5" />
                  <a
                    href={booking.zoom_join_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    Zoomリンクはこちら
                  </a>
                </div>
              )}
              {!booking.zoom_join_url && (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Video className="h-4 w-4" />
                  <span>Zoom URLは後ほどお知らせします</span>
                </div>
              )}
            </div>
          )}

          {/* アクションボタン */}
          <div className="space-y-3 pt-4">
            {booking && (
              <Link href={`/bookings/${booking.id}`} className="block">
                <Button className="w-full bg-orange-500 hover:bg-orange-600">
                  予約詳細を確認
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            )}
            <Link href="/dashboard" className="block">
              <Button variant="outline" className="w-full">
                ダッシュボードへ
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
