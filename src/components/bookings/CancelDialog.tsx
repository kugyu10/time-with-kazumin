"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { XCircle, Loader2 } from "lucide-react"

type Props = {
  bookingId: number
  pointsToRefund: number
  menuName: string
}

export function CancelDialog({ bookingId, pointsToRefund, menuName }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "キャンセルに失敗しました")
        setIsLoading(false)
        return
      }

      // 成功時はダイアログを閉じて一覧に戻る
      setIsOpen(false)
      router.push("/bookings")
      router.refresh()
    } catch {
      setError("通信エラーが発生しました")
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full">
          <XCircle className="h-4 w-4 mr-2" />
          予約をキャンセル
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>予約をキャンセルしますか?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                <span className="font-medium">{menuName}</span> の予約をキャンセルします。
              </p>
              {pointsToRefund > 0 && (
                <p className="text-orange-600 font-medium">
                  {pointsToRefund} ポイントが返還されます
                </p>
              )}
              {error && (
                <p className="text-red-500 text-sm">
                  {error}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>戻る</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleCancel()
            }}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                処理中...
              </>
            ) : (
              "キャンセルする"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
