"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

type AccountStatus = {
  configured: boolean
  connected: boolean
  error?: string
}

type ZoomStatus = {
  accountA: AccountStatus
  accountB: AccountStatus
}

export function ZoomConnectionStatus() {
  const [status, setStatus] = useState<ZoomStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/zoom/status")
      if (!response.ok) {
        throw new Error("ステータス取得に失敗しました")
      }
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        接続状態を確認中...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <XCircle className="size-4" />
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <AccountStatusRow label="Zoom A（カジュアル用）" status={status?.accountA} />
        <AccountStatusRow label="Zoom B（有料用）" status={status?.accountB} />
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={fetchStatus}
        className="gap-2"
      >
        <RefreshCw className="size-3" />
        再確認
      </Button>
    </div>
  )
}

function AccountStatusRow({
  label,
  status,
}: {
  label: string
  status?: AccountStatus
}) {
  if (!status) {
    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-sm">{label}</span>
        <span className="text-sm text-muted-foreground">-</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {!status.configured ? (
          <>
            <AlertCircle className="size-4 text-yellow-500" />
            <span className="text-sm text-yellow-600">未設定</span>
          </>
        ) : status.connected ? (
          <>
            <CheckCircle2 className="size-4 text-green-500" />
            <span className="text-sm text-green-600">接続OK</span>
          </>
        ) : (
          <>
            <XCircle className="size-4 text-red-500" />
            <span className="text-sm text-red-600">
              接続エラー{status.error && `(${status.error})`}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
