"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SlotPicker } from "@/components/bookings/SlotPicker"
import { cn } from "@/lib/utils"
import { ArrowLeft, Loader2 } from "lucide-react"

interface Schedule {
  day_of_week: number
  start_time: string
  end_time: string
}

interface SelectedSlot {
  date: string
  startTime: string
  endTime: string
}

interface GuestBookingClientProps {
  schedules: Schedule[]
}

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"]
const GUEST_DURATION_MINUTES = 30 // ゲスト予約は30分固定

export function GuestBookingClient({ schedules }: GuestBookingClientProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null)
  const [bookingMinHoursAhead, setBookingMinHoursAhead] = useState<number>(24)

  // Form state
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/public/settings")
        if (response.ok) {
          const data = await response.json()
          setBookingMinHoursAhead(data.booking_min_hours_ahead || 24)
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err)
      }
    }
    fetchSettings()
  }, [])

  const handleSlotSelect = (slot: SelectedSlot) => {
    setSelectedSlot(slot)
    setStep(2)
  }

  const handlePrevStep = () => {
    setStep(1)
    setError(null)
  }

  const formatSlotTime = (slot: SelectedSlot) => {
    const date = new Date(slot.startTime)
    const endDate = new Date(slot.endTime)
    const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}(${DAY_NAMES[date.getDay()]})`
    const startStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    const endStr = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`
    return `${dateStr} ${startStr} - ${endStr}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlot) return

    setError(null)

    if (!name.trim()) {
      setError("お名前を入力してください")
      return
    }
    if (name.trim().length < 2) {
      setError("お名前は2文字以上で入力してください")
      return
    }
    if (!email.trim()) {
      setError("メールアドレスを入力してください")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("有効なメールアドレスを入力してください")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/guest/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
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

      router.push(`/guest/booking/success?token=${result.guest_token}&cancel_token=${result.cancel_token}`)
    } catch (err) {
      console.error("Booking submission failed:", err)
      setError("予約処理中にエラーが発生しました")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
            step >= 1 ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-500"
          )}
        >
          1
        </div>
        <div className={cn("h-1 w-12", step >= 2 ? "bg-orange-500" : "bg-gray-200")} />
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
            step >= 2 ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-500"
          )}
        >
          2
        </div>
      </div>
      <div className="flex justify-center gap-8 text-sm text-gray-600">
        <span className={cn(step === 1 && "font-semibold text-orange-600")}>日時選択</span>
        <span className={cn(step === 2 && "font-semibold text-orange-600")}>情報入力</span>
      </div>

      {step === 1 ? (
        <div className="rounded-lg bg-white p-4 shadow-sm sm:p-6">
          <SlotPicker
            schedules={schedules}
            durationMinutes={GUEST_DURATION_MINUTES}
            selectedSlot={selectedSlot}
            onSelectSlot={handleSlotSelect}
            bookingMinHoursAhead={bookingMinHoursAhead}
          />
          <p className="mt-4 text-center text-xs text-gray-500">
            空いている時間をタップして予約へ進めます
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">予約情報を入力</h2>

          {selectedSlot && (
            <div className="mb-6 rounded-lg bg-orange-50 p-4">
              <p className="text-sm text-gray-600">選択中の日時</p>
              <p className="mt-1 text-lg font-semibold text-orange-700">
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

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={handlePrevStep}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                戻る
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    予約処理中...
                  </>
                ) : (
                  "予約する"
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
