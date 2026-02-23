"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PointBalance } from "@/components/dashboard/PointBalance"
import { createClient } from "@/lib/supabase/client"
import { LogOut, CalendarPlus } from "lucide-react"

interface HeaderProps {
  currentPoints: number
}

export function Header({ currentPoints }: HeaderProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <header className="border-b border-orange-100 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        <Link
          href="/dashboard"
          className="text-lg font-semibold text-orange-600 hover:text-orange-700"
        >
          かずみん、時間空いてる？
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/bookings/new">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <CalendarPlus className="h-4 w-4" />
              <span className="hidden sm:inline">予約する</span>
            </Button>
          </Link>

          <PointBalance currentPoints={currentPoints} variant="compact" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="gap-1.5 text-gray-600 hover:text-gray-800"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">ログアウト</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
