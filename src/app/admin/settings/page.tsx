import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GoogleConnectButton } from "@/components/admin/GoogleConnectButton"
import { GoogleConnectionStatus } from "@/components/admin/GoogleConnectionStatus"
import { ZoomConnectionStatus } from "@/components/admin/ZoomConnectionStatus"
import { Calendar, Video } from "lucide-react"

export default function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ oauth?: string; error?: string; message?: string }>
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">設定</h1>
        <p className="text-muted-foreground mt-2">
          外部サービスとの連携設定を管理できます
        </p>
      </div>

      {/* Googleカレンダー連携 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-md">
              <Calendar className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle>Googleカレンダー連携</CardTitle>
              <CardDescription>
                予約をGoogleカレンダーに自動登録します
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={<div className="text-sm text-muted-foreground">読み込み中...</div>}>
            <GoogleConnectionStatus searchParams={searchParams} />
          </Suspense>
          <GoogleConnectButton />
        </CardContent>
      </Card>

      {/* Zoom連携 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-md">
              <Video className="size-5 text-blue-500" />
            </div>
            <div>
              <CardTitle>Zoom連携</CardTitle>
              <CardDescription>
                予約時にZoomミーティングを自動作成します
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ZoomConnectionStatus />
          <p className="text-xs text-muted-foreground mt-4">
            ※ Zoomの設定は環境変数で行います。変更が必要な場合は開発者にご連絡ください。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
