"use client"

import { useSearchParams } from "next/navigation"
import { CheckCircle } from "lucide-react"

export function SuccessMessageClient() {
  const searchParams = useSearchParams()
  const bookingSuccess = searchParams.get("booking_success")

  if (bookingSuccess !== "true") return null

  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-700">
      <CheckCircle className="h-5 w-5" />
      <span>予約が完了しました</span>
    </div>
  )
}
