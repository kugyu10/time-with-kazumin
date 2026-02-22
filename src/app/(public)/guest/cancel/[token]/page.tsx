/**
 * Guest Cancel Page
 *
 * ゲスト予約キャンセルページ
 * - トークン検証
 * - 予約詳細表示
 * - キャンセル確認ダイアログ
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { AlertCircle, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSupabaseServiceRole } from "@/lib/supabase/service-role"
import { verifyCancelToken } from "@/lib/tokens/cancel-token"
import { CancelPageClient } from "./CancelPageClient"

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function GuestCancelPage({ params }: PageProps) {
  const { token } = await params

  // 1. トークン検証
  const payload = await verifyCancelToken(token)
  if (!payload) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            無効なリンクです
          </h1>
          <p className="mb-6 text-gray-600">
            このキャンセルリンクは無効か、有効期限が切れています。
            <br />
            予約確認メールから再度お試しください。
          </p>
          <Link href="/guest/booking">
            <Button>予約ページへ</Button>
          </Link>
        </div>
      </div>
    )
  }

  // 2. 予約詳細を取得
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
      meeting_menus (
        name
      )
    `)
    .eq("id", payload.booking_id)
    .single() as {
      data: {
        id: number
        guest_name: string
        guest_email: string
        start_time: string
        end_time: string
        status: string
        meeting_menus: { name: string } | null
      } | null
      error: { message: string } | null
    }

  // 予約が見つからない
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
            <Button>予約ページへ</Button>
          </Link>
        </div>
      </div>
    )
  }

  // 3. メールアドレスの照合
  if (booking.guest_email?.toLowerCase() !== payload.email.toLowerCase()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            無効なリンクです
          </h1>
          <p className="mb-6 text-gray-600">
            このキャンセルリンクは無効です。
          </p>
          <Link href="/guest/booking">
            <Button>予約ページへ</Button>
          </Link>
        </div>
      </div>
    )
  }

  // 4. 既にキャンセル済み
  if (booking.status === "canceled") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <CheckCircle className="h-8 w-8 text-gray-600" />
          </div>
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            キャンセル済みです
          </h1>
          <p className="mb-6 text-gray-600">
            この予約は既にキャンセルされています。
          </p>
          <Link href="/guest/booking">
            <Button>新しい予約をする</Button>
          </Link>
        </div>
      </div>
    )
  }

  // 5. 予約開始時刻を過ぎている
  const startTime = new Date(booking.start_time)
  if (startTime < new Date()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <XCircle className="h-8 w-8 text-yellow-600" />
          </div>
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            キャンセルできません
          </h1>
          <p className="mb-6 text-gray-600">
            予約開始時刻を過ぎているため、キャンセルできません。
          </p>
          <Link href="/guest/booking">
            <Button>別の予約をする</Button>
          </Link>
        </div>
      </div>
    )
  }

  // 日時のフォーマット
  const endTime = new Date(booking.end_time)
  const formattedDate = startTime.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  })
  const formattedTime = `${startTime.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${endTime.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  })}`

  // 6. キャンセル可能 - クライアントコンポーネントへ渡す
  return (
    <CancelPageClient
      token={token}
      booking={{
        menuName: booking.meeting_menus?.name || "カジュアル30分セッション",
        guestName: booking.guest_name,
        formattedDate,
        formattedTime,
      }}
    />
  )
}
