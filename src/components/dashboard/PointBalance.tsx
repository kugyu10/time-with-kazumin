"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Coins } from "lucide-react"
import { cn } from "@/lib/utils"

interface PointBalanceProps {
  currentPoints: number
  monthlyPoints?: number
  planName?: string
  variant?: "compact" | "detailed"
}

export function PointBalance({
  currentPoints,
  monthlyPoints,
  planName,
  variant = "compact",
}: PointBalanceProps) {
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-1.5 text-sm">
        <Coins className="h-4 w-4 text-orange-500" />
        <span className="font-medium">{currentPoints}</span>
        <span className="text-gray-500">pt</span>
      </div>
    )
  }

  // Detailed variant for dashboard
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-gray-700">
          ポイント残高
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <Coins className="h-6 w-6 text-orange-500" />
          <span className="text-3xl font-bold text-gray-900">{currentPoints}</span>
          <span className="text-gray-500">ポイント</span>
        </div>
        {monthlyPoints !== undefined && (
          <div className="mt-2 text-sm text-gray-600">
            月間付与: {monthlyPoints}ポイント
            {planName && (
              <span className="ml-2 text-gray-400">({planName}プラン)</span>
            )}
          </div>
        )}
        <div className={cn(
          "mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200",
        )}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500"
            style={{
              width: `${monthlyPoints ? Math.min((currentPoints / monthlyPoints) * 100, 100) : 50}%`,
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
