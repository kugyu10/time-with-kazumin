import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarPlus, LogIn } from "lucide-react"

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ログイン済みならダッシュボードへ
  if (user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-yellow-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-orange-100">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-bold text-orange-600">
            かずみん、時間空いてる？
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            コーチ・対話師かずみんの
            <br />
            セッション予約サービス
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link href="/guest/booking" className="block">
            <Button className="w-full gap-2" size="lg">
              <CalendarPlus className="h-5 w-5" />
              ゲストとして予約する
            </Button>
          </Link>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">または</span>
            </div>
          </div>

          <Link href="/login" className="block">
            <Button variant="outline" className="w-full gap-2" size="lg">
              <LogIn className="h-5 w-5" />
              会員ログイン
            </Button>
          </Link>

          <p className="text-center text-xs text-muted-foreground pt-2">
            会員の方はログインすると
            <br />
            ポイントを使って予約できます
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
