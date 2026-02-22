"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BookingConfirm } from "@/components/bookings/BookingConfirm"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"
import type { Menu } from "@/components/bookings/MenuSelect"
import { generateIdempotencyKey } from "@/lib/utils/idempotency"

function BookingConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const menuId = searchParams.get("menu_id")
  const startTime = searchParams.get("start_time")
  const endTime = searchParams.get("end_time")

  const [menu, setMenu] = useState<Menu | null>(null)
  const [currentPoints, setCurrentPoints] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [idempotencyKey] = useState(() => generateIdempotencyKey())

  const fetchData = useCallback(async () => {
    if (!menuId) {
      setError("メニューが指定されていません")
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()

      // Get user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push("/login")
        return
      }

      // Fetch menu
      const { data: menuData, error: menuError } = await supabase
        .from("meeting_menus")
        .select("id, name, description, duration_minutes, points_required")
        .eq("id", Number(menuId))
        .eq("is_active", true)
        .single()

      if (menuError || !menuData) {
        setError("メニューが見つかりません")
        setIsLoading(false)
        return
      }

      // Fetch member plan for points
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: memberPlan, error: planError } = await (supabase as any)
        .from("member_plans")
        .select("current_points")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single() as { data: { current_points: number } | null; error: Error | null }

      if (planError || !memberPlan) {
        setError("会員プランが見つかりません")
        setIsLoading(false)
        return
      }

      setMenu(menuData)
      setCurrentPoints(memberPlan.current_points)
    } catch (err) {
      console.error("Failed to fetch data:", err)
      setError("データの読み込みに失敗しました")
    } finally {
      setIsLoading(false)
    }
  }, [menuId, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleConfirm = async () => {
    if (!menu || !startTime || !endTime) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          menu_id: menu.id,
          start_time: startTime,
          end_time: endTime,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "予約に失敗しました")
        return
      }

      // Success - redirect to dashboard with success message
      router.push("/dashboard?booking_success=true")
    } catch (err) {
      console.error("Booking failed:", err)
      setError("予約処理中にエラーが発生しました")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.back()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (!menu || !startTime || !endTime) {
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="rounded-lg bg-red-50 p-4 text-red-600">
          {error || "予約情報が不正です"}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <BookingConfirm
        menu={menu}
        startTime={startTime}
        endTime={endTime}
        currentPoints={currentPoints}
        isSubmitting={isSubmitting}
        error={error}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  )
}

export default function BookingConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      }
    >
      <BookingConfirmContent />
    </Suspense>
  )
}
