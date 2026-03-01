"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Clock,
  Calendar,
  Users,
  ListOrdered,
  CreditCard,
  ListChecks,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  {
    label: "ダッシュボード",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "営業時間",
    href: "/admin/schedules",
    icon: Clock,
  },
  {
    label: "予約管理",
    href: "/admin/bookings",
    icon: Calendar,
  },
  {
    label: "会員管理",
    href: "/admin/members",
    icon: Users,
  },
  {
    label: "メニュー管理",
    href: "/admin/menus",
    icon: ListOrdered,
  },
  {
    label: "プラン管理",
    href: "/admin/plans",
    icon: CreditCard,
  },
  {
    label: "タスク履歴",
    href: "/admin/tasks",
    icon: ListChecks,
  },
  {
    label: "設定",
    href: "/admin/settings",
    icon: Settings,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r bg-muted/30 min-h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold">Admin</h1>
      </div>
      <nav className="px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
