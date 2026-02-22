import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function NewBookingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold text-orange-600 mb-6">
        新規予約
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>セッションを予約する</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            ログイン中: {user?.email}
          </p>
          <p className="text-sm text-gray-400 mt-4">
            予約フロー（メニュー選択、空き時間カレンダー、確認画面）は
            Phase 2 Plan 02で実装予定です。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
