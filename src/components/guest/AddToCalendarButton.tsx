"use client"

import { Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { generateGoogleCalendarUrl } from "@/lib/calendar/url-generator"

interface AddToCalendarButtonProps {
  title: string
  startTime: Date
  endTime: Date
  description?: string
  location?: string
}

export function AddToCalendarButton({
  title,
  startTime,
  endTime,
  description,
  location,
}: AddToCalendarButtonProps) {
  const calendarUrl = generateGoogleCalendarUrl({
    title,
    startTime,
    endTime,
    description,
    location,
  })

  return (
    <Button
      asChild
      className="bg-blue-600 hover:bg-blue-700"
    >
      <a
        href={calendarUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Calendar className="mr-2 h-4 w-4" />
        Googleカレンダーに追加
      </a>
    </Button>
  )
}
