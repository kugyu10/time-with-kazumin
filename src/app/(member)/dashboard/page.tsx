import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold text-orange-600 mb-6">
        ダッシュボード
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>ようこそ</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            ログイン中: {user?.email}
          </p>
          <p className="text-sm text-gray-400 mt-4">
            ダッシュボードの詳細はPhase 2 Plan 03で実装予定です。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
