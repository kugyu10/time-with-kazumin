"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createClient()

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      if (signInError.message.includes("Invalid login credentials")) {
        setError("メールアドレスまたはパスワードが正しくありません")
      } else {
        setError(signInError.message)
      }
      setIsLoading(false)
      return
    }

    // 成功時はリダイレクト（ミドルウェアで処理）
    window.location.href = "/bookings/new"
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-gray-700">
          メールアドレス
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@email.com"
          required
          disabled={isLoading}
          className="border-gray-300"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-gray-700">
          パスワード
        </Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          required
          disabled={isLoading}
          className="border-gray-300"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>
      )}

      <Button
        type="submit"
        variant="outline"
        disabled={isLoading}
        className="w-full border-orange-300 text-orange-600 hover:bg-orange-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ログイン中...
          </>
        ) : (
          "メールアドレスでログイン"
        )}
      </Button>
    </form>
  )
}
