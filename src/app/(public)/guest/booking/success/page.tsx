/**
 * Guest Booking Success Page
 *
 * ゲスト予約完了ページ
 * - 予約詳細表示
 * - Googleカレンダー追加ボタン
 * - キャンセルリンク
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"
import { AddToCalendarButton } from "@/components/guest/AddToCalendarButton"

interface PageProps {
  searchParams: Promise<{
    token?: string
    cancel_token?: string
  }>
}

export default async function GuestBookingSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { token, cancel_token } = params

  // トークンがない場合
  if (!token) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            無効なアクセスです
          </h1>
          <p className="mb-6 text-gray-600">
            予約情報が見つかりません。
          </p>
          <Link href="/guest/booking">
            <Button>予約ページへ戻る</Button>
          </Link>
        </div>
      </div>
    )
  }

  // 予約詳細を取得
  const supabase = getSupabaseServiceRole()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error } = await (supabase as any)
    .from("bookings")
    .select(`
      id,
      guest_name,
      guest_email,
      start_time,
      end_time,
      status,
      zoom_join_url,
      meeting_menus (
        name
      )
    `)
    .eq("guest_token", token)
    .single() as {
      data: {
        id: number
        guest_name: string
        guest_email: string
        start_time: string
        end_time: string
        status: string
        zoom_join_url: string | null
        meeting_menus: { name: string } | null
      } | null
      error: { message: string } | null
    }

  // 予約が見つからない場合
  if (error || !booking) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            予約が見つかりません
          </h1>
          <p className="mb-6 text-gray-600">
            予約情報の取得に失敗しました。
          </p>
          <Link href="/guest/booking">
            <Button>予約ページへ戻る</Button>
          </Link>
        </div>
      </div>
    )
  }

  // 日時のフォーマット
  const startDate = new Date(booking.start_time)
  const endDate = new Date(booking.end_time)
  const formattedDate = startDate.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  })
  const formattedTime = `${startDate.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${endDate.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  })}`

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-lg bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>

          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            ご予約ありがとうございます
          </h1>

          <p className="text-gray-600">
            予約確認メールをお送りしました。
            <br />
            当日はZoomでお会いしましょう!
          </p>
        </div>

        {/* 予約詳細 */}
        <div className="mb-6 rounded-lg bg-gray-50 p-4">
          <h2 className="mb-3 font-semibold text-gray-900">予約詳細</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex">
              <dt className="w-24 text-gray-500">メニュー</dt>
              <dd className="text-gray-900">{booking.meeting_menus?.name || "発光ポジティブちょい浴び30分"}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-gray-500">日時</dt>
              <dd className="text-gray-900">{formattedDate}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-gray-500">時間</dt>
              <dd className="text-gray-900">{formattedTime}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-gray-500">お名前</dt>
              <dd className="text-gray-900">{booking.guest_name}</dd>
            </div>
            {booking.zoom_join_url && (
              <div className="flex">
                <dt className="w-24 text-gray-500">Zoom</dt>
                <dd className="text-gray-900">
                  <a
                    href={booking.zoom_join_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    ミーティングに参加
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Googleカレンダー追加 */}
        <div className="mb-6 flex justify-center">
          <AddToCalendarButton
            title={`${booking.meeting_menus?.name || "発光ポジティブちょい浴び30分"} with かずみん`}
            startTime={startDate}
            endTime={endDate}
            description={
              booking.zoom_join_url
                ? `Zoom: ${booking.zoom_join_url}\n\n予約者: ${booking.guest_name}`
                : `予約者: ${booking.guest_name}`
            }
          />
        </div>

        {/* 注意事項 */}
        <div className="mb-6 rounded-lg bg-orange-50 p-4 text-left">
          <h2 className="mb-2 font-semibold text-orange-800">ご確認ください</h2>
          <ul className="space-y-2 text-sm text-orange-700">
            <li>- 予約確認メールをご確認ください</li>
            <li>- 上記Zoomリンクから当日ご参加ください</li>
            <li>- キャンセルは下記リンクから行えます</li>
          </ul>
        </div>

        {/* アクション */}
        <div className="flex flex-col items-center space-y-3">
          {cancel_token && (
            <Link
              href={`/guest/cancel/${cancel_token}`}
              className="text-sm text-red-600 hover:text-red-700 hover:underline"
            >
              予約をキャンセルする
            </Link>
          )}
          <Link href="/guest/booking">
            <Button variant="outline">別の日程を予約する</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
