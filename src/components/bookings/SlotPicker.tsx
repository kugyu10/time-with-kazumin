"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

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

interface SlotPickerProps {
  schedules: Schedule[]
  existingBookings: Booking[]
  durationMinutes: number
  selectedSlot: { date: string; startTime: string; endTime: string } | null
  onSelectSlot: (slot: { date: string; startTime: string; endTime: string }) => void
}

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"]

export function SlotPicker({
  schedules,
  existingBookings,
  durationMinutes,
  selectedSlot,
  onSelectSlot,
}: SlotPickerProps) {
  const [weekOffset, setWeekOffset] = useState(0)

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

  // Generate week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      return {
        date,
        dateStr: date.toISOString().split("T")[0],
        dayOfWeek: date.getDay(),
        label: `${date.getMonth() + 1}/${date.getDate()}(${DAY_NAMES[date.getDay()]})`,
      }
    })
  }, [weekStart])

  // Generate available slots for each day
  const generateSlots = (dayInfo: (typeof weekDays)[0]) => {
    const schedule = schedules.find((s) => s.day_of_week === dayInfo.dayOfWeek)
    if (!schedule) return []

    const slots: { startTime: string; endTime: string; available: boolean }[] = []
    const [startHour, startMin] = schedule.start_time.split(":").map(Number)
    const [endHour, endMin] = schedule.end_time.split(":").map(Number)

    const scheduleStart = startHour * 60 + startMin
    const scheduleEnd = endHour * 60 + endMin

    // Generate slots at 30-minute intervals
    for (let time = scheduleStart; time + durationMinutes <= scheduleEnd; time += 30) {
      const slotStartHour = Math.floor(time / 60)
      const slotStartMin = time % 60
      const slotEndTime = time + durationMinutes
      const slotEndHour = Math.floor(slotEndTime / 60)
      const slotEndMin = slotEndTime % 60

      const startTimeStr = `${String(slotStartHour).padStart(2, "0")}:${String(slotStartMin).padStart(2, "0")}`
      const endTimeStr = `${String(slotEndHour).padStart(2, "0")}:${String(slotEndMin).padStart(2, "0")}`

      // Check if slot overlaps with existing bookings
      const slotStartISO = `${dayInfo.dateStr}T${startTimeStr}:00`
      const slotEndISO = `${dayInfo.dateStr}T${endTimeStr}:00`

      const isBooked = existingBookings.some((booking) => {
        if (booking.status === "canceled") return false
        const bookingStart = new Date(booking.start_time).getTime()
        const bookingEnd = new Date(booking.end_time).getTime()
        const slotStart = new Date(slotStartISO).getTime()
        const slotEnd = new Date(slotEndISO).getTime()
        return slotStart < bookingEnd && slotEnd > bookingStart
      })

      // Check if slot is in the past
      const slotDateTime = new Date(`${dayInfo.dateStr}T${startTimeStr}:00`)
      const isPast = slotDateTime < new Date()

      slots.push({
        startTime: startTimeStr,
        endTime: endTimeStr,
        available: !isBooked && !isPast,
      })
    }

    return slots
  }

  const handleSlotClick = (dayInfo: (typeof weekDays)[0], slot: { startTime: string; endTime: string }) => {
    const startISO = `${dayInfo.dateStr}T${slot.startTime}:00`
    const endISO = `${dayInfo.dateStr}T${slot.endTime}:00`
    onSelectSlot({
      date: dayInfo.dateStr,
      startTime: startISO,
      endTime: endISO,
    })
  }

  const isSlotSelected = (dayInfo: (typeof weekDays)[0], slot: { startTime: string }) => {
    if (!selectedSlot) return false
    return (
      selectedSlot.date === dayInfo.dateStr &&
      selectedSlot.startTime.includes(slot.startTime)
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

      <div className="overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7 gap-2">
          {weekDays.map((dayInfo) => {
            const slots = generateSlots(dayInfo)
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
                  {slots.length === 0 ? (
                    <div className="rounded bg-gray-50 py-4 text-center text-xs text-gray-400">
                      休日
                    </div>
                  ) : (
                    slots.map((slot) => (
                      <button
                        key={slot.startTime}
                        disabled={!slot.available}
                        onClick={() => handleSlotClick(dayInfo, slot)}
                        className={cn(
                          "w-full rounded px-2 py-1.5 text-xs transition-colors",
                          slot.available
                            ? isSlotSelected(dayInfo, slot)
                              ? "bg-orange-500 text-white"
                              : "bg-orange-100 text-orange-800 hover:bg-orange-200"
                            : "cursor-not-allowed bg-gray-100 text-gray-400 line-through"
                        )}
                      >
                        {slot.startTime}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
