"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Clock, Coins } from "lucide-react"

export interface Menu {
  id: number
  name: string
  description: string | null
  duration_minutes: number
  points_required: number
}

interface MenuSelectProps {
  menus: Menu[]
  selectedMenuId: number | null
  onSelect: (menu: Menu) => void
}

export function MenuSelect({ menus, selectedMenuId, onSelect }: MenuSelectProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">メニューを選択</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {menus.map((menu) => (
          <Card
            key={menu.id}
            className={cn(
              "cursor-pointer transition-all hover:border-orange-400 hover:shadow-md",
              selectedMenuId === menu.id
                ? "border-2 border-orange-500 bg-orange-50 shadow-md"
                : "border-gray-200"
            )}
            onClick={() => onSelect(menu)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{menu.name}</CardTitle>
              {menu.description && (
                <CardDescription className="text-sm">
                  {menu.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{menu.duration_minutes}分</span>
                </div>
                <div className="flex items-center gap-1">
                  <Coins className="h-4 w-4 text-orange-500" />
                  <span className="font-medium text-orange-600">
                    {menu.points_required}ポイント
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
