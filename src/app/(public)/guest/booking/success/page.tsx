/**
 * Guest Booking Success Page
 *
 * ゲスト予約完了ページ
 */

// 動的レンダリングを強制（クエリパラメータを使用）
export const dynamic = "force-dynamic"

import Link from "next/link"
import { CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GuestBookingSuccessPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-lg bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>

        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          ご予約ありがとうございます
        </h1>

        <p className="mb-6 text-gray-600">
          予約確認メールをお送りしました。
          <br />
          当日はZoomでお会いしましょう！
        </p>

        <div className="rounded-lg bg-orange-50 p-4 text-left">
          <h2 className="mb-2 font-semibold text-orange-800">ご確認ください</h2>
          <ul className="space-y-2 text-sm text-orange-700">
            <li>- 予約確認メールをご確認ください</li>
            <li>- Zoomリンクはメールに記載されています</li>
            <li>- キャンセルは予約確認メールから行えます</li>
          </ul>
        </div>

        <div className="mt-8">
          <Link href="/guest/booking">
            <Button variant="outline">
              別の日程を予約する
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
