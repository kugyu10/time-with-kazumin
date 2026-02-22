"use client"

import { BookingCard, type BookingCardData } from "./BookingCard"
import { CalendarX } from "lucide-react"

type Props = {
  bookings: BookingCardData[]
  emptyMessage?: string
}

export function BookingList({ bookings, emptyMessage = "予約がありません" }: Props) {
  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <CalendarX className="h-12 w-12 mb-4 text-gray-300" />
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} />
      ))}
    </div>
  )
}
