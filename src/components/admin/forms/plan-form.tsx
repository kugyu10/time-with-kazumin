"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Checkbox } from "@/components/ui/checkbox"
import { createPlan, updatePlan } from "@/lib/actions/admin/plans"

const formSchema = z.object({
  name: z.string().min(1, "プラン名は必須です").max(100, "プラン名は100文字以内で入力してください"),
  monthly_points: z.number().min(0, "0以上で設定してください"),
  price_yen: z.number().min(0, "0以上で設定してください"),
  description: z.string().optional(),
  is_active: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

type PlanFormProps = {
  plan?: {
    id: number
    name: string
    monthly_points: number
    price_monthly: number | null
    is_active: boolean
  }
  onSuccess?: () => void
  onCancel?: () => void
}

export function PlanForm({ plan, onSuccess, onCancel }: PlanFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: plan?.name ?? "",
      monthly_points: plan?.monthly_points ?? 100,
      price_yen: plan?.price_monthly ?? 0,
      description: "",
      is_active: plan?.is_active ?? true,
    },
  })

  function onSubmit(values: FormValues) {
    setError(null)

    startTransition(async () => {
      try {
        if (plan) {
          await updatePlan(plan.id, values)
        } else {
          await createPlan(values)
        }
        onSuccess?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました")
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>プラン名</FormLabel>
              <FormControl>
                <Input placeholder="例: スタンダードプラン" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="monthly_points"
            render={({ field }) => (
              <FormItem>
                <FormLabel>月間ポイント</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  毎月付与されるポイント数
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price_yen"
            render={({ field }) => (
              <FormItem>
                <FormLabel>月額料金（円）</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>有効</FormLabel>
                <FormDescription>
                  有効にすると新規会員がこのプランを選択できます
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {error && (
          <div className="text-sm text-destructive">{error}</div>
        )}

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              キャンセル
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "保存中..." : plan ? "更新" : "作成"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
