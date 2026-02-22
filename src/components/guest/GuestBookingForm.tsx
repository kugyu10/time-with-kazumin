"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface SelectedSlot {
  date: string
  startTime: string
  endTime: string
}

interface GuestBookingFormProps {
  selectedSlot: SelectedSlot | null
  onSubmit: (data: { email: string; name: string }) => Promise<void>
  isSubmitting: boolean
  error: string | null
}

export function GuestBookingForm({
  selectedSlot,
  onSubmit,
  isSubmitting,
  error,
}: GuestBookingFormProps) {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  const formatSlotTime = (slot: SelectedSlot) => {
    const date = new Date(slot.startTime)
    const endDate = new Date(slot.endTime)
    const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
    const startStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    const endStr = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`
    return `${dateStr} ${startStr} - ${endStr}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    // クライアントサイドバリデーション
    if (!name.trim()) {
      setLocalError("お名前を入力してください")
      return
    }
    if (name.trim().length < 2) {
      setLocalError("お名前は2文字以上で入力してください")
      return
    }
    if (name.trim().length > 100) {
      setLocalError("お名前は100文字以内で入力してください")
      return
    }
    if (!email.trim()) {
      setLocalError("メールアドレスを入力してください")
      return
    }
    // 簡易的なメール形式チェック
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError("有効なメールアドレスを入力してください")
      return
    }

    await onSubmit({ email: email.trim(), name: name.trim() })
  }

  const displayError = error || localError

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">予約情報</h2>

      {selectedSlot && (
        <div className="mb-6 rounded-lg bg-orange-50 p-4">
          <p className="text-sm text-gray-600">選択中の日時</p>
          <p className="mt-1 font-semibold text-orange-700">
            {formatSlotTime(selectedSlot)}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            お名前 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="山田 太郎"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            disabled={isSubmitting}
          />
          <p className="mt-1 text-xs text-gray-500">2〜100文字</p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@mail.com"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            disabled={isSubmitting}
          />
          <p className="mt-1 text-xs text-gray-500">予約確認メールをお送りします</p>
        </div>

        {displayError && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{displayError}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={!selectedSlot || isSubmitting}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
        >
          {isSubmitting ? "予約処理中..." : "予約する"}
        </Button>
      </form>
    </div>
  )
}
