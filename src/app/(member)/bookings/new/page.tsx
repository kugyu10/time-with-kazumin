"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { MenuSelect, type Menu } from "@/components/bookings/MenuSelect"
import { SlotPicker } from "@/components/bookings/SlotPicker"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react"

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

export default function BookingNewPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [menus, setMenus] = useState<Menu[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [existingBookings, setExistingBookings] = useState<Booking[]>([])
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string
    startTime: string
    endTime: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch menus and schedules
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Fetch menus (exclude zoom_account B for members)
      const { data: menusData, error: menusError } = await supabase
        .from("meeting_menus")
        .select("id, name, description, duration_minutes, points_required")
        .eq("is_active", true)
        .neq("zoom_account", "B")
        .order("points_required", { ascending: true })

      if (menusError) throw menusError

      // Fetch schedules
      const { data: schedulesData, error: schedulesError } = await supabase
        .from("weekly_schedules")
        .select("day_of_week, start_time, end_time")

      if (schedulesError) throw schedulesError

      // Fetch existing bookings (next 5 weeks)
      const now = new Date()
      const fiveWeeksLater = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000)

      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("start_time, end_time, status")
        .gte("start_time", now.toISOString())
        .lte("start_time", fiveWeeksLater.toISOString())
        .neq("status", "canceled")

      if (bookingsError) throw bookingsError

      setMenus(menusData || [])
      setSchedules(schedulesData || [])
      setExistingBookings(bookingsData || [])
    } catch (err) {
      console.error("Failed to fetch data:", err)
      setError("データの読み込みに失敗しました")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleMenuSelect = (menu: Menu) => {
    setSelectedMenu(menu)
    setSelectedSlot(null) // Reset slot when menu changes
  }

  const handleSlotSelect = (slot: {
    date: string
    startTime: string
    endTime: string
  }) => {
    setSelectedSlot(slot)
  }

  const handleNextStep = () => {
    if (step === 1 && selectedMenu) {
      setStep(2)
    }
  }

  const handlePrevStep = () => {
    if (step === 2) {
      setStep(1)
      setSelectedSlot(null)
    }
  }

  const handleConfirm = () => {
    if (!selectedMenu || !selectedSlot) return

    // Navigate to confirm page with params
    const params = new URLSearchParams({
      menu_id: String(selectedMenu.id),
      start_time: selectedSlot.startTime,
      end_time: selectedSlot.endTime,
    })
    router.push(`/bookings/confirm?${params.toString()}`)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-4">
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              step >= 1 ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-500"
            }`}
          >
            1
          </div>
          <div
            className={`h-1 w-16 ${step >= 2 ? "bg-orange-500" : "bg-gray-200"}`}
          />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              step >= 2 ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-500"
            }`}
          >
            2
          </div>
        </div>
        <div className="mt-2 flex justify-center gap-16 text-sm text-gray-600">
          <span>メニュー選択</span>
          <span>日時選択</span>
        </div>
      </div>

      {/* Step content */}
      <div className="rounded-lg bg-white p-6 shadow-sm">
        {step === 1 ? (
          <MenuSelect
            menus={menus}
            selectedMenuId={selectedMenu?.id || null}
            onSelect={handleMenuSelect}
          />
        ) : (
          selectedMenu && (
            <SlotPicker
              schedules={schedules}
              existingBookings={existingBookings}
              durationMinutes={selectedMenu.duration_minutes}
              selectedSlot={selectedSlot}
              onSelectSlot={handleSlotSelect}
            />
          )
        )}
      </div>

      {/* Navigation buttons */}
      <div className="mt-6 flex justify-between">
        {step === 2 ? (
          <Button variant="outline" onClick={handlePrevStep}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            戻る
          </Button>
        ) : (
          <div />
        )}

        {step === 1 ? (
          <Button
            onClick={handleNextStep}
            disabled={!selectedMenu}
            className="bg-orange-500 hover:bg-orange-600"
          >
            次へ
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleConfirm}
            disabled={!selectedSlot}
            className="bg-orange-500 hover:bg-orange-600"
          >
            確認画面へ
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
