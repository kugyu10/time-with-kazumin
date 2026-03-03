"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
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
import { updateHolidaySchedule, type Schedule } from "@/lib/actions/admin/schedules"

const formSchema = z.object({
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式で入力してください"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式で入力してください"),
  is_available: z.boolean(),
  break_start_time: z.string().optional(),
  break_end_time: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

type HolidayScheduleFormProps = {
  initialSchedule: Schedule | null
}

/**
 * 祝日専用の営業時間設定フォーム
 * 全曜日共通の1つの営業時間を設定する
 */
export function HolidayScheduleForm({ initialSchedule }: HolidayScheduleFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      start_time: initialSchedule?.start_time.slice(0, 5) ?? "09:00",
      end_time: initialSchedule?.end_time.slice(0, 5) ?? "18:00",
      is_available: !!initialSchedule,
      break_start_time: initialSchedule?.break_start_time?.slice(0, 5) ?? "",
      break_end_time: initialSchedule?.break_end_time?.slice(0, 5) ?? "",
    },
  })

  function onSubmit(values: FormValues) {
    setError(null)
    setSuccess(false)

    startTransition(async () => {
      try {
        await updateHolidaySchedule({
          start_time: values.start_time,
          end_time: values.end_time,
          is_available: values.is_available,
          break_start_time: values.break_start_time || undefined,
          break_end_time: values.break_end_time || undefined,
        })
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました")
      }
    })
  }

  const isAvailable = form.watch("is_available")

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="is_available"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  祝日に営業する
                </FormLabel>
                <p className="text-sm text-muted-foreground">
                  チェックを外すと、祝日は全て休業日になります
                </p>
              </div>
            </FormItem>
          )}
        />

        <div className="rounded-md border p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="start_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>開始時刻</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                      disabled={!isAvailable}
                      className={!isAvailable ? "opacity-50" : ""}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="end_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>終了時刻</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                      disabled={!isAvailable}
                      className={!isAvailable ? "opacity-50" : ""}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="break_start_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>休憩開始（任意）</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                      value={field.value ?? ""}
                      disabled={!isAvailable}
                      className={!isAvailable ? "opacity-50" : ""}
                      placeholder="任意"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="break_end_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>休憩終了（任意）</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                      value={field.value ?? ""}
                      disabled={!isAvailable}
                      className={!isAvailable ? "opacity-50" : ""}
                      placeholder="任意"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
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
