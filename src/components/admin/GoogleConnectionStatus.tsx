import { isAuthenticated, isConfigured } from "@/lib/integrations/oauth/google"
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"

type Props = {
  searchParams: Promise<{ oauth?: string; error?: string; message?: string }>
}

export async function GoogleConnectionStatus({ searchParams }: Props) {
  const params = await searchParams
  const configured = isConfigured()
  const connected = configured ? await isAuthenticated() : false

  return (
    <div className="space-y-3">
      {/* 成功メッセージ */}
      {params.oauth === "success" && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-md text-sm">
          <CheckCircle2 className="size-4" />
          Googleカレンダーとの連携が完了しました
        </div>
      )}

      {/* エラーメッセージ */}
      {params.error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          <XCircle className="size-4" />
          連携に失敗しました: {params.message || params.error}
        </div>
      )}

      {/* 連携状態 */}
      <div className="flex items-center gap-2">
        {!configured ? (
          <>
            <AlertCircle className="size-4 text-yellow-500" />
            <span className="text-sm text-yellow-600">
              環境変数が設定されていません（GOOGLE_CLIENT_ID等）
            </span>
          </>
        ) : connected ? (
          <>
            <CheckCircle2 className="size-4 text-green-500" />
            <span className="text-sm text-green-600">連携済み</span>
          </>
        ) : (
          <>
            <XCircle className="size-4 text-gray-400" />
            <span className="text-sm text-muted-foreground">未連携</span>
          </>
        )}
      </div>
    </div>
  )
}
