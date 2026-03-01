"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { SlotPicker } from "@/components/bookings/SlotPicker"
import { GuestBookingForm } from "@/components/guest/GuestBookingForm"

interface Schedule {
  day_of_week: number
  start_time: string
  end_time: string
}

interface Booking {
  start_time: string
  end_time: string
  status: string
}

interface SelectedSlot {
  date: string
  startTime: string
  endTime: string
}

interface GuestBookingClientProps {
  schedules: Schedule[]
}

export function GuestBookingClient({ schedules }: GuestBookingClientProps) {
  const router = useRouter()
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null)
  const [existingBookings, setExistingBookings] = useState<Booking[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 今日から5週間分の予約を取得
  useEffect(() => {
    async function fetchBookings() {
      try {
        const today = new Date()
        const fiveWeeksLater = new Date()
        fiveWeeksLater.setDate(today.getDate() + 35)

        // 各日の予約を取得（公開API経由）
        // 簡易実装: 現在の週のみ取得
        // 実際の予約重複チェックはサーバーサイドで行う
        const bookings: Booking[] = []

        // Format date as YYYY-MM-DD in local timezone
        const formatDateLocal = (d: Date): string => {
          const year = d.getFullYear()
          const month = String(d.getMonth() + 1).padStart(2, "0")
          const day = String(d.getDate()).padStart(2, "0")
          return `${year}-${month}-${day}`
        }

        // 今日から35日分の日付をループ
        for (let i = 0; i < 35; i++) {
          const date = new Date(today)
          date.setDate(today.getDate() + i)
          const dateStr = formatDateLocal(date)

          const response = await fetch(`/api/public/slots?date=${dateStr}`)
          if (response.ok) {
            const data = await response.json()
            // 利用不可のスロットを予約として追加
            for (const slot of data.slots || []) {
              if (!slot.available) {
                bookings.push({
                  start_time: slot.startTime,
                  end_time: slot.endTime,
                  status: "confirmed",
                })
              }
            }
          }
        }

        setExistingBookings(bookings)
      } catch (err) {
        console.error("Failed to fetch bookings:", err)
      }
    }

    fetchBookings()
  }, [])

  const handleSubmit = async (data: { email: string; name: string }) => {
    if (!selectedSlot) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/guest/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          name: data.name,
          slotDate: selectedSlot.date,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || "予約に失敗しました")
        return
      }

      // 成功: 完了ページへリダイレクト（guest_tokenとcancel_tokenの両方を渡す）
      router.push(`/guest/booking/success?token=${result.guest_token}&cancel_token=${result.cancel_token}`)
    } catch (err) {
      console.error("Booking submission failed:", err)
      setError("予約処理中にエラーが発生しました")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <SlotPicker
          schedules={schedules}
          existingBookings={existingBookings}
          durationMinutes={30}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
        />
      </div>

      <GuestBookingForm
        selectedSlot={selectedSlot}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        error={error}
      />
    </div>
  )
}
