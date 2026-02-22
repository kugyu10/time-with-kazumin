"use client"

import { useState } from "react"
import Link from "next/link"
import { Calendar, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CancelConfirmDialog } from "@/components/guest/CancelConfirmDialog"

interface CancelPageClientProps {
  token: string
  booking: {
    menuName: string
    guestName: string
    formattedDate: string
    formattedTime: string
  }
}

export function CancelPageClient({ token, booking }: CancelPageClientProps) {
  const [isCanceled, setIsCanceled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // キャンセル完了
  if (isCanceled) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            キャンセルが完了しました
          </h1>
          <p className="mb-6 text-gray-600">
            ご予約をキャンセルしました。
            <br />
            またのご利用をお待ちしております。
          </p>
          <Link href="/guest/booking">
            <Button>新しい予約をする</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-lg bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <XCircle className="h-8 w-8 text-yellow-600" />
          </div>

          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            予約のキャンセル
          </h1>

          <p className="text-gray-600">
            以下の予約をキャンセルしますか?
          </p>
        </div>

        {/* 予約詳細 */}
        <div className="mb-6 rounded-lg bg-gray-50 p-4">
          <h2 className="mb-3 font-semibold text-gray-900">予約詳細</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex">
              <dt className="w-24 text-gray-500">メニュー</dt>
              <dd className="text-gray-900">{booking.menuName}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-gray-500">日時</dt>
              <dd className="text-gray-900">{booking.formattedDate}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-gray-500">時間</dt>
              <dd className="text-gray-900">{booking.formattedTime}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-gray-500">お名前</dt>
              <dd className="text-gray-900">{booking.guestName}</dd>
            </div>
          </dl>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* アクション */}
        <div className="flex flex-col items-center space-y-3">
          <CancelConfirmDialog
            token={token}
            onCancelComplete={() => setIsCanceled(true)}
            onCancelError={(err) => setError(err)}
          />
          <Link href="/guest/booking">
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              予約ページへ戻る
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
