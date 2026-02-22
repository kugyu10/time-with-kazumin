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
import { createMember } from "@/lib/actions/admin/members"

const formSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  full_name: z.string().min(1, "名前は必須です").max(100, "名前は100文字以内で入力してください"),
  plan_id: z.number().min(1, "プランを選択してください"),
})

type FormValues = z.infer<typeof formSchema>

type Plan = {
  id: number
  name: string
  monthly_points: number
}

type MemberFormProps = {
  plans: Plan[]
  onSuccess?: () => void
  onCancel?: () => void
}

export function MemberForm({ plans, onSuccess, onCancel }: MemberFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      full_name: "",
      plan_id: 0,
    },
  })

  function onSubmit(values: FormValues) {
    setError(null)

    startTransition(async () => {
      try {
        await createMember(values)
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
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>メールアドレス</FormLabel>
              <FormControl>
                <Input type="email" placeholder="member@example.com" {...field} />
              </FormControl>
              <FormDescription>
                登録後、パスワード設定用のメールが送信されます
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>名前</FormLabel>
              <FormControl>
                <Input placeholder="山田 太郎" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="plan_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>プラン</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(Number(value))}
                defaultValue={field.value ? String(field.value) : undefined}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="プランを選択" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={String(plan.id)}>
                      {plan.name} ({plan.monthly_points} pt/月)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                初回ポイントとしてプランの月次ポイントが付与されます
              </FormDescription>
              <FormMessage />
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
            {isPending ? "登録中..." : "登録"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
