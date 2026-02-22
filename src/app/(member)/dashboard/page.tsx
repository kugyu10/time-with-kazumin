import { redirect } from "next/navigation"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { PointBalance } from "@/components/dashboard/PointBalance"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarPlus, CalendarDays } from "lucide-react"
import Link from "next/link"
import { SuccessMessageClient } from "./SuccessMessage"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single() as { data: { full_name: string | null } | null }

  // Get member plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberPlan } = await (supabase as any)
    .from("member_plans")
    .select(`
      current_points,
      monthly_points,
      plans (
        name
      )
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single() as { data: { current_points: number; monthly_points: number; plans: { name: string } } | null }

  // Get upcoming bookings count
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: upcomingCount } = await (supabase as any)
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .gte("start_time", now)
    .neq("status", "canceled") as { count: number | null }

  return (
    <div className="mx-auto max-w-4xl p-4">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {profile?.full_name ? `${profile.full_name}さん` : "こんにちは"}
        </h1>
        <p className="text-gray-600">かずみんとの時間を予約しましょう</p>
      </div>

      {/* Success message */}
      <Suspense fallback={null}>
        <SuccessMessageClient />
      </Suspense>

      {/* Main cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Point Balance */}
        {memberPlan && (
          <PointBalance
            currentPoints={memberPlan.current_points}
            monthlyPoints={memberPlan.monthly_points}
            planName={memberPlan.plans?.name}
            variant="detailed"
          />
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-gray-700">
              クイックアクション
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/bookings/new" className="block">
              <Button className="w-full justify-start gap-2 bg-orange-500 hover:bg-orange-600">
                <CalendarPlus className="h-4 w-4" />
                新規予約
              </Button>
            </Link>
            <Link href="/bookings" className="block">
              <Button variant="outline" className="w-full justify-start gap-2">
                <CalendarDays className="h-4 w-4" />
                予約一覧
                {upcomingCount !== null && upcomingCount > 0 && (
                  <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-600">
                    {upcomingCount}件
                  </span>
                )}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming summary */}
      {upcomingCount !== null && upcomingCount > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-gray-700">
              今後の予約
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              {upcomingCount}件の予約があります
            </p>
            <Link href="/bookings" className="mt-2 inline-block text-sm text-orange-600 hover:underline">
              詳細を見る
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
