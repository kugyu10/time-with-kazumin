import { getBookings } from "@/lib/actions/admin/bookings"
import { BookingsClient } from "./bookings-client"

export default async function BookingsPage() {
  const bookings = await getBookings()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">予約管理</h1>
          <p className="text-muted-foreground mt-2">
            全ての予約を確認し、ステータス変更やキャンセルができます
          </p>
        </div>
      </div>

      <BookingsClient initialBookings={bookings} />
    </div>
  )
}
