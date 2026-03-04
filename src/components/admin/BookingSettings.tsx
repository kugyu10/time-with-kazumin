"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export function BookingSettings() {
  const [minHoursAhead, setMinHoursAhead] = useState<string>("24")
  const [bufferBefore, setBufferBefore] = useState<string>("30")
  const [bufferAfter, setBufferAfter] = useState<string>("0")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/admin/settings")
        if (response.ok) {
          const data = await response.json()
          setMinHoursAhead(data.settings?.booking_min_hours_ahead || "24")
          setBufferBefore(data.settings?.buffer_before_minutes || "30")
          setBufferAfter(data.settings?.buffer_after_minutes || "0")
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)

    try {
      // 全設定を順次保存
      const settings = [
        { key: "booking_min_hours_ahead", value: minHoursAhead },
        { key: "buffer_before_minutes", value: bufferBefore },
        { key: "buffer_after_minutes", value: bufferAfter },
      ]

      for (const setting of settings) {
        const response = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(setting),
        })

        if (!response.ok) {
          const data = await response.json()
          setMessage({ type: "error", text: data.error || "保存に失敗しました" })
          return
        }
      }

      setMessage({ type: "success", text: "設定を保存しました" })
    } catch (error) {
      console.error("Failed to save settings:", error)
      setMessage({ type: "error", text: "保存に失敗しました" })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        読み込み中...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="minHoursAhead">予約可能時間（現在から何時間後以降）</Label>
        <div className="flex items-center gap-2">
          <Input
            id="minHoursAhead"
            type="number"
            min="0"
            max="168"
            value={minHoursAhead}
            onChange={(e) => setMinHoursAhead(e.target.value)}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">時間後から予約可能</span>
        </div>
        <p className="text-xs text-muted-foreground">
          例: 24を設定すると、現在から24時間後以降のスロットのみ予約可能になります
        </p>
      </div>

      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-3">ミーティングバッファ</h4>
        <p className="text-xs text-muted-foreground mb-4">
          予定の前後に余裕を持たせるための時間枠です。Googleカレンダーの予定や既存予約の前後にバッファを適用して空きスロットを計算します。
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bufferBefore">ミーティング前バッファ</Label>
            <div className="flex items-center gap-2">
              <Input
                id="bufferBefore"
                type="number"
                min="0"
                max="120"
                value={bufferBefore}
                onChange={(e) => setBufferBefore(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">分</span>
            </div>
            <p className="text-xs text-muted-foreground">
              予定の前に確保する空き時間
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bufferAfter">ミーティング後バッファ</Label>
            <div className="flex items-center gap-2">
              <Input
                id="bufferAfter"
                type="number"
                min="0"
                max="120"
                value={bufferAfter}
                onChange={(e) => setBufferAfter(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">分</span>
            </div>
            <p className="text-xs text-muted-foreground">
              予定の後に確保する空き時間
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
          保存
        </Button>
        {message && (
          <span
            className={`text-sm ${
              message.type === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  )
}
