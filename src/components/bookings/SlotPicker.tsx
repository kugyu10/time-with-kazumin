"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

interface Schedule {
  day_of_week: number
  start_time: string
  end_time: string
}

interface Slot {
  date: string
  startTime: string
  endTime: string
  available: boolean
}

interface SlotPickerProps {
  schedules: Schedule[]
  durationMinutes: number
  selectedSlot: { date: string; startTime: string; endTime: string } | null
  onSelectSlot: (slot: { date: string; startTime: string; endTime: string }) => void
  bookingMinHoursAhead?: number
}

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"]

export function SlotPicker({
  schedules,
  durationMinutes,
  selectedSlot,
  onSelectSlot,
  bookingMinHoursAhead = 24,
}: SlotPickerProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekSlots, setWeekSlots] = useState<Map<string, Slot[]>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  // Get start of current week (Monday)
  const getWeekStart = (offset: number) => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Monday = 1
    const monday = new Date(now)
    monday.setDate(now.getDate() + diff + offset * 7)
    monday.setHours(0, 0, 0, 0)
    return monday
  }

  const weekStart = getWeekStart(weekOffset)

  // Format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  // Generate week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      const dayOfWeek = date.getDay()
      const hasSchedule = schedules.some(s => s.day_of_week === dayOfWeek)
      return {
        date,
        dateStr: formatDateLocal(date),
        dayOfWeek,
        dayName: DAY_NAMES[dayOfWeek],
        dayNum: date.getDate(),
        month: date.getMonth() + 1,
        hasSchedule,
        label: `${date.getMonth() + 1}/${date.getDate()}(${DAY_NAMES[dayOfWeek]})`,
      }
    })
  }, [weekStart, schedules])

  // Fetch slots from API
  useEffect(() => {
    async function fetchWeekSlots() {
      setIsLoading(true)

      try {
        const startDateStr = formatDateLocal(weekStart)
        const response = await fetch(
          `/api/public/slots/week?start=${startDateStr}&duration=${durationMinutes}&minHours=${bookingMinHoursAhead}`
        )

        if (response.ok) {
          const data = await response.json()
          const slotsMap = new Map<string, Slot[]>()

          if (data.slots) {
            Object.entries(data.slots).forEach(([dateStr, slots]) => {
              slotsMap.set(dateStr, slots as Slot[])
            })
          }

          setWeekSlots(slotsMap)
        }
      } catch (err) {
        console.error("Failed to fetch slots:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchWeekSlots()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, durationMinutes, bookingMinHoursAhead])

  // ISO文字列から時刻部分（HH:MM）を抽出
  const extractTime = (isoString: string): string => {
    // "2026-03-02T10:00:00+09:00" -> "10:00"
    const match = isoString.match(/T(\d{2}:\d{2})/)
    return match ? match[1] : isoString
  }

  const handleSlotClick = (dateStr: string, slot: Slot) => {
    onSelectSlot({
      date: dateStr,
      startTime: slot.startTime, // APIからのISO文字列をそのまま使用
      endTime: slot.endTime,
    })
  }

  const isSlotSelected = (dateStr: string, slot: Slot) => {
    if (!selectedSlot) return false
    return (
      selectedSlot.date === dateStr &&
      selectedSlot.startTime === slot.startTime
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">日時を選択</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((o) => o - 1)}
            disabled={weekOffset === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[120px] text-center text-sm">
            {weekDays[0].label} - {weekDays[6].label}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((o) => o + 1)}
            disabled={weekOffset >= 4}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-7 gap-2">
            {weekDays.map((dayInfo) => {
              const slots = weekSlots.get(dayInfo.dateStr) || []
              return (
                <div key={dayInfo.dateStr} className="space-y-2">
                  <div
                    className={cn(
                      "rounded-lg bg-gray-100 py-2 text-center text-sm font-medium",
                      dayInfo.dayOfWeek === 0 && "text-red-600",
                      dayInfo.dayOfWeek === 6 && "text-blue-600"
                    )}
                  >
                    {dayInfo.label}
                  </div>
                  <div className="space-y-1">
                    {!dayInfo.hasSchedule ? (
                      <div className="rounded bg-gray-50 py-4 text-center text-xs text-gray-400">
                        休日
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="rounded bg-gray-50 py-4 text-center text-xs text-gray-400">
                        空きなし
                      </div>
                    ) : (
                      slots.map((slot) => (
                        <button
                          key={slot.startTime}
                          disabled={!slot.available}
                          onClick={() => handleSlotClick(dayInfo.dateStr, slot)}
                          className={cn(
                            "w-full rounded px-2 py-1.5 text-xs transition-colors",
                            slot.available
                              ? isSlotSelected(dayInfo.dateStr, slot)
                                ? "bg-orange-500 text-white"
                                : "bg-orange-100 text-orange-800 hover:bg-orange-200"
                              : "cursor-not-allowed bg-gray-100 text-gray-400 line-through"
                          )}
                        >
                          {extractTime(slot.startTime)}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
