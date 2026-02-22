"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Coins, Loader2 } from "lucide-react"
import type { Menu } from "./MenuSelect"

interface BookingConfirmProps {
  menu: Menu
  startTime: string
  endTime: string
  currentPoints: number
  isSubmitting: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

function formatDateTime(isoString: string) {
  const date = new Date(isoString)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const dayName = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()]
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${month}月${day}日(${dayName}) ${hours}:${minutes}`
}

export function BookingConfirm({
  menu,
  startTime,
  endTime,
  currentPoints,
  isSubmitting,
  error,
  onConfirm,
  onCancel,
}: BookingConfirmProps) {
  const hasEnoughPoints = currentPoints >= menu.points_required
  const remainingPoints = currentPoints - menu.points_required

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">予約内容の確認</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-orange-100 p-2">
              <Calendar className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">メニュー</p>
              <p className="font-medium">{menu.name}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">日時</p>
              <p className="font-medium">{formatDateTime(startTime)}</p>
              <p className="text-sm text-gray-600">
                {menu.duration_minutes}分 ({formatDateTime(endTime)} まで)
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="rounded-full bg-yellow-100 p-2">
              <Coins className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">消費ポイント</p>
              <p className="font-medium text-orange-600">
                {menu.points_required}ポイント
              </p>
              <p className="text-sm text-gray-600">
                予約後の残高: {remainingPoints}ポイント
                <span className="ml-1 text-gray-400">
                  (現在: {currentPoints}pt)
                </span>
              </p>
            </div>
          </div>
        </div>

        {!hasEnoughPoints && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            ポイント残高が不足しています。残り{menu.points_required - currentPoints}ポイント必要です。
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1"
        >
          戻る
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isSubmitting || !hasEnoughPoints}
          className="flex-1 bg-orange-500 hover:bg-orange-600"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              予約中...
            </>
          ) : (
            "予約する"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
