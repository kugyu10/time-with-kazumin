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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { createMenu, updateMenu } from "@/lib/actions/admin/menus"

const formSchema = z.object({
  name: z.string().min(1, "メニュー名は必須です").max(100, "メニュー名は100文字以内で入力してください"),
  duration_minutes: z.number().min(15, "15分以上で設定してください").max(480, "8時間以内で設定してください"),
  points_required: z.number().min(0, "0以上で設定してください"),
  zoom_account: z.enum(["A", "B"]),
  description: z.string().optional(),
  is_active: z.boolean(),
  send_thank_you_email: z.boolean(),
  allowed_plan_types: z.array(z.number()).optional(),
})

type FormValues = z.infer<typeof formSchema>

type MenuFormProps = {
  menu?: {
    id: number
    name: string
    duration_minutes: number
    points_required: number
    zoom_account: "A" | "B"
    description: string | null
    is_active: boolean
    send_thank_you_email: boolean
    allowed_plan_types: number[] | null
  }
  plans?: Array<{ id: number; name: string }>
  onSuccess?: () => void
  onCancel?: () => void
}

export function MenuForm({ menu, plans, onSuccess, onCancel }: MenuFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: menu?.name ?? "",
      duration_minutes: menu?.duration_minutes ?? 60,
      points_required: menu?.points_required ?? 100,
      zoom_account: menu?.zoom_account ?? "A",
      description: menu?.description ?? "",
      is_active: menu?.is_active ?? true,
      send_thank_you_email: menu?.send_thank_you_email ?? false,
      allowed_plan_types: menu?.allowed_plan_types ?? [],
    },
  })

  function onSubmit(values: FormValues) {
    setError(null)

    startTransition(async () => {
      try {
        const allowedPlanTypes = values.allowed_plan_types?.length
          ? values.allowed_plan_types
          : null
        const submitValues = { ...values, allowed_plan_types: allowedPlanTypes }
        if (menu) {
          await updateMenu(menu.id, submitValues)
        } else {
          await createMenu(submitValues)
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
              <FormLabel>メニュー名</FormLabel>
              <FormControl>
                <Input placeholder="例: 30分カジュアルトーク" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="duration_minutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>所要時間（分）</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={15}
                    max={480}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="points_required"
            render={({ field }) => (
              <FormItem>
                <FormLabel>必要ポイント</FormLabel>
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
          name="zoom_account"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zoomアカウント</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="アカウントを選択" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="A">アカウントA</SelectItem>
                  <SelectItem value="B">アカウントB</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                使用するZoomアカウントを選択してください
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>説明（任意）</FormLabel>
              <FormControl>
                <Input placeholder="メニューの説明..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                  有効にするとユーザーがこのメニューを選択できます
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="send_thank_you_email"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>サンキューメールを送信</FormLabel>
                <FormDescription>
                  このメニューのセッション終了後にサンキューメールを送信します
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {plans && plans.length > 0 && (
          <div className="space-y-2">
            <FormLabel>対象プランタイプ</FormLabel>
            <FormDescription>
              未選択の場合、全プランの会員に表示されます
            </FormDescription>
            {plans.map((plan) => (
              <FormField
                key={plan.id}
                control={form.control}
                name="allowed_plan_types"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value?.includes(plan.id)}
                        onCheckedChange={(checked) => {
                          const current = field.value ?? []
                          field.onChange(
                            checked
                              ? [...current, plan.id]
                              : current.filter((id: number) => id !== plan.id)
                          )
                        }}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">{plan.name}</FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>
        )}

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
            {isPending ? "保存中..." : menu ? "更新" : "作成"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
