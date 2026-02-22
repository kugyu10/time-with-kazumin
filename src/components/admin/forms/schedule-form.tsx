"use client"

import { useState, useTransition } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import { updateSchedules, type Schedule } from "@/lib/actions/admin/schedules"

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"]

const scheduleEntrySchema = z.object({
  day_of_week: z.number(),
  start_time: z.string(),
  end_time: z.string(),
  is_available: z.boolean(),
})

const formSchema = z.object({
  schedules: z.array(scheduleEntrySchema).length(7),
})

type FormValues = z.infer<typeof formSchema>

type ScheduleFormProps = {
  initialSchedules: Schedule[]
  isHolidayPattern: boolean
}

/**
 * Convert database schedules to form values
 */
function schedulesToFormValues(schedules: Schedule[]): FormValues["schedules"] {
  // Create default values for all 7 days
  const defaults = DAY_NAMES.map((_, index) => ({
    day_of_week: index,
    start_time: "09:00",
    end_time: "18:00",
    is_available: false,
  }))

  // Overlay existing schedules
  schedules.forEach((schedule) => {
    const day = schedule.day_of_week
    if (day >= 0 && day <= 6) {
      defaults[day] = {
        day_of_week: day,
        start_time: schedule.start_time.slice(0, 5), // "HH:MM:SS" -> "HH:MM"
        end_time: schedule.end_time.slice(0, 5),
        is_available: true,
      }
    }
  })

  return defaults
}

export function ScheduleForm({ initialSchedules, isHolidayPattern }: ScheduleFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      schedules: schedulesToFormValues(initialSchedules),
    },
  })

  const { fields } = useFieldArray({
    control: form.control,
    name: "schedules",
  })

  function onSubmit(values: FormValues) {
    setError(null)
    setSuccess(false)

    startTransition(async () => {
      try {
        await updateSchedules(isHolidayPattern, values.schedules)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました")
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="rounded-md border">
          <div className="grid grid-cols-[80px_1fr_1fr_80px] gap-4 p-4 border-b bg-muted/50 font-medium text-sm">
            <div>曜日</div>
            <div>開始時刻</div>
            <div>終了時刻</div>
            <div>営業</div>
          </div>

          {fields.map((field, index) => {
            const isAvailable = form.watch(`schedules.${index}.is_available`)

            return (
              <div
                key={field.id}
                className="grid grid-cols-[80px_1fr_1fr_80px] gap-4 p-4 border-b last:border-b-0 items-center"
              >
                <div className="font-medium">
                  {DAY_NAMES[field.day_of_week]}曜日
                </div>

                <FormField
                  control={form.control}
                  name={`schedules.${index}.start_time`}
                  render={({ field: inputField }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="time"
                          {...inputField}
                          disabled={!isAvailable}
                          className={!isAvailable ? "opacity-50" : ""}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`schedules.${index}.end_time`}
                  render={({ field: inputField }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="time"
                          {...inputField}
                          disabled={!isAvailable}
                          className={!isAvailable ? "opacity-50" : ""}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`schedules.${index}.is_available`}
                  render={({ field: checkboxField }) => (
                    <FormItem className="flex items-center justify-center">
                      <FormControl>
                        <Checkbox
                          checked={checkboxField.value}
                          onCheckedChange={checkboxField.onChange}
                        />
                      </FormControl>
                      <FormLabel className="sr-only">
                        {DAY_NAMES[field.day_of_week]}曜日を営業日にする
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            )
          })}
        </div>

        {error && (
          <div className="text-sm text-destructive">{error}</div>
        )}

        {success && (
          <div className="text-sm text-green-600">保存しました</div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
