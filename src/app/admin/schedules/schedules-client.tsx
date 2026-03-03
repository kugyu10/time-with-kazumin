"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScheduleForm } from "@/components/admin/forms/schedule-form"
import { HolidayScheduleForm } from "@/components/admin/forms/holiday-schedule-form"
import type { Schedule } from "@/lib/actions/admin/schedules"

type SchedulesClientProps = {
  weekdaySchedules: Schedule[]
  holidaySchedules: Schedule[]
}

export function SchedulesClient({
  weekdaySchedules,
  holidaySchedules,
}: SchedulesClientProps) {
  return (
    <Tabs defaultValue="weekday" className="space-y-4">
      <TabsList>
        <TabsTrigger value="weekday">平日パターン</TabsTrigger>
        <TabsTrigger value="holiday">祝日パターン</TabsTrigger>
      </TabsList>

      <TabsContent value="weekday">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">平日パターン</h2>
          <p className="text-sm text-muted-foreground mb-6">
            通常営業日のスケジュールを設定します。
          </p>
          <ScheduleForm
            initialSchedules={weekdaySchedules}
            isHolidayPattern={false}
          />
        </div>
      </TabsContent>

      <TabsContent value="holiday">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">祝日パターン</h2>
          <p className="text-sm text-muted-foreground mb-6">
            祝日は曜日に関係なく、この営業時間が適用されます。
          </p>
          <HolidayScheduleForm
            initialSchedule={holidaySchedules[0] ?? null}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}
