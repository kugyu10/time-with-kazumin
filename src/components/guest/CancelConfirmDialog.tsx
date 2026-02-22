"use client"

import { useState } from "react"
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

interface CancelConfirmDialogProps {
  token: string
  onCancelComplete: () => void
  onCancelError: (error: string) => void
}

export function CancelConfirmDialog({
  token,
  onCancelComplete,
  onCancelError,
}: CancelConfirmDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleCancel = async () => {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/guest/cancel/${token}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (!response.ok) {
        onCancelError(result.error || "キャンセルに失敗しました")
        return
      }

      setIsOpen(false)
      onCancelComplete()
    } catch (error) {
      console.error("Cancel failed:", error)
      onCancelError("キャンセル処理中にエラーが発生しました")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button className="bg-red-600 text-white hover:bg-red-700">予約をキャンセル</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>予約をキャンセルしますか?</AlertDialogTitle>
          <AlertDialogDescription>
            この操作は取り消せません。予約をキャンセルすると、確保した時間枠は解放されます。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>戻る</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? "処理中..." : "キャンセルする"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
