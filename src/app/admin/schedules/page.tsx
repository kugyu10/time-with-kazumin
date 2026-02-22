import { getSchedules } from "@/lib/actions/admin/schedules"
import { SchedulesClient } from "./schedules-client"

export default async function SchedulesPage() {
  // Fetch both weekday and holiday patterns
  const [weekdaySchedules, holidaySchedules] = await Promise.all([
    getSchedules(false),
    getSchedules(true),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">営業時間設定</h1>
        <p className="text-muted-foreground mt-2">
          曜日ごとの営業時間を設定します。平日と祝日で異なるパターンを設定できます。
        </p>
      </div>

      <SchedulesClient
        weekdaySchedules={weekdaySchedules}
        holidaySchedules={holidaySchedules}
      />
    </div>
  )
}
