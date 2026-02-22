"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookingList } from "./BookingList"
import type { BookingCardData } from "./BookingCard"

type Props = {
  upcomingBookings: BookingCardData[]
  pastBookings: BookingCardData[]
}

export function BookingTabs({ upcomingBookings, pastBookings }: Props) {
  return (
    <Tabs defaultValue="upcoming" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="upcoming">
          今後の予約
          {upcomingBookings.length > 0 && (
            <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-600">
              {upcomingBookings.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="past">
          過去の予約
          {pastBookings.length > 0 && (
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {pastBookings.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming" className="mt-4">
        <BookingList
          bookings={upcomingBookings}
          emptyMessage="今後の予約はありません"
        />
      </TabsContent>

      <TabsContent value="past" className="mt-4">
        <BookingList
          bookings={pastBookings}
          emptyMessage="過去の予約はありません"
        />
      </TabsContent>
    </Tabs>
  )
}
