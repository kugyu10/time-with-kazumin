import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CancelDialog } from "@/components/bookings/CancelDialog"
import { Calendar, Clock, MapPin, ArrowLeft, Video } from "lucide-react"
import Link from "next/link"

// 予約データの型
type BookingDetail = {
  id: number
  start_time: string
  end_time: string
  status: "confirmed" | "completed" | "canceled"
  zoom_join_url: string | null
  meeting_menus: {
    name: string
    duration_minutes: number
    points_required: number
  } | null
}

// ステータスバッジの色を取得
function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "confirmed":
      return "default"
    case "completed":
      return "secondary"
    case "canceled":
      return "outline"
    default:
      return "secondary"
  }
}

// ステータスの日本語表示
function getStatusLabel(status: string): string {
  switch (status) {
    case "confirmed":
      return "確定"
    case "completed":
      return "完了"
    case "canceled":
      return "キャンセル済"
    default:
      return status
  }
}

// 日時のフォーマット（詳細版）
function formatDateTimeFull(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }) + " " + date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function BookingDetailPage({ params }: PageProps) {
  const { id } = await params
  const bookingId = parseInt(id, 10)

  if (isNaN(bookingId)) {
    notFound()
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // 予約詳細を取得（RLS適用で本人のみ）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error } = await (supabase as any)
    .from("bookings")
    .select(`
      id,
      start_time,
      end_time,
      status,
      zoom_join_url,
      meeting_menus (
        name,
        duration_minutes,
        points_required
      )
    `)
    .eq("id", bookingId)
    .single() as { data: BookingDetail | null; error: Error | null }

  if (error || !booking) {
    notFound()
  }

  const menu = booking.meeting_menus
  const menuName = menu?.name ?? "不明なメニュー"
  const duration = menu?.duration_minutes ?? 0
  const pointsRequired = menu?.points_required ?? 0

  // キャンセル可能かどうか
  const now = new Date()
  const startTime = new Date(booking.start_time)
  const canCancel =
    booking.status === "confirmed" &&
    startTime > now

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* 戻るボタン */}
      <Link href="/bookings" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        予約一覧に戻る
      </Link>

      {/* 予約詳細カード */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{menuName}</CardTitle>
            <Badge variant={getStatusBadgeVariant(booking.status)}>
              {getStatusLabel(booking.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 日時情報 */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-gray-700">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span>{formatDateTimeFull(booking.start_time)}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <Clock className="h-5 w-5 text-gray-400" />
              <span>{duration}分</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <MapPin className="h-5 w-5 text-gray-400" />
              <span>オンライン (Zoom)</span>
            </div>
          </div>

          {/* 消費ポイント */}
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">消費ポイント</div>
            <div className="text-2xl font-bold text-orange-600">
              {pointsRequired} pt
            </div>
          </div>

          {/* Zoom URL（確定済みの場合のみ表示） */}
          {booking.status === "confirmed" && booking.zoom_join_url && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Video className="h-4 w-4" />
                Zoom ミーティング
              </div>
              <a
                href={booking.zoom_join_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {booking.zoom_join_url}
              </a>
            </div>
          )}

          {/* キャンセルボタン（今後の予約かつ確定済みの場合のみ） */}
          {canCancel && (
            <div className="pt-4 border-t">
              <CancelDialog
                bookingId={booking.id}
                pointsToRefund={pointsRequired}
                menuName={menuName}
              />
            </div>
          )}

          {/* キャンセル済みの場合のメッセージ */}
          {booking.status === "canceled" && (
            <div className="pt-4 border-t">
              <div className="text-center text-gray-500">
                <p>この予約はキャンセルされました</p>
                <p className="text-sm mt-1">ポイントは返還済みです</p>
              </div>
            </div>
          )}

          {/* 過去の予約の場合のメッセージ */}
          {booking.status === "confirmed" && startTime <= now && (
            <div className="pt-4 border-t">
              <div className="text-center text-gray-500">
                <p>この予約は終了しました</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ダッシュボードへのリンク */}
      <div className="mt-6 text-center">
        <Link href="/dashboard">
          <Button variant="outline">ダッシュボードへ</Button>
        </Link>
      </div>
    </div>
  )
}
