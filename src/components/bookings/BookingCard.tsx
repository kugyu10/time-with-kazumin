"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, ChevronRight } from "lucide-react"

export type BookingCardData = {
  id: number
  start_time: string
  end_time: string
  status: "confirmed" | "completed" | "canceled"
  meeting_menus: {
    name: string
    duration_minutes: number
    points_required: number
  } | null
}

type Props = {
  booking: BookingCardData
}

// ステータスバッジの色を取得
function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "confirmed":
      return "default" // 緑系
    case "completed":
      return "secondary" // グレー系
    case "canceled":
      return "outline" // ボーダーのみ
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

// 日時のフォーマット
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  }) + " " + date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  })
}

export function BookingCard({ booking }: Props) {
  const menuName = booking.meeting_menus?.name ?? "不明なメニュー"
  const duration = booking.meeting_menus?.duration_minutes ?? 0

  return (
    <Link href={`/bookings/${booking.id}`} className="block">
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-2">
              {/* メニュー名とステータス */}
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-gray-900">{menuName}</h3>
                <Badge variant={getStatusBadgeVariant(booking.status)}>
                  {getStatusLabel(booking.status)}
                </Badge>
              </div>

              {/* 日時情報 */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDateTime(booking.start_time)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{duration}分</span>
                </div>
              </div>
            </div>

            {/* 矢印アイコン */}
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
