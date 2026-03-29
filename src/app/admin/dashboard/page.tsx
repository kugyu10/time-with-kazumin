import { Suspense } from "react"
import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Clock,
  Calendar,
  Users,
  ListOrdered,
  CreditCard,
} from "lucide-react"
import { FollowUpList } from "./follow-up-list"

const quickLinks = [
  {
    title: "営業時間",
    description: "営業時間の設定を管理",
    href: "/admin/business-hours",
    icon: Clock,
  },
  {
    title: "予約管理",
    description: "予約の確認・キャンセル",
    href: "/admin/bookings",
    icon: Calendar,
  },
  {
    title: "会員管理",
    description: "会員情報の確認・編集",
    href: "/admin/members",
    icon: Users,
  },
  {
    title: "メニュー管理",
    description: "セッションメニューの管理",
    href: "/admin/menus",
    icon: ListOrdered,
  },
  {
    title: "プラン管理",
    description: "サブスクリプションプランの管理",
    href: "/admin/plans",
    icon: CreditCard,
  },
]

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">管理画面</h1>
        <p className="text-muted-foreground mt-2">
          各種設定や管理機能にアクセスできます
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => {
          const Icon = link.icon

          return (
            <Link key={link.href} href={link.href}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <Icon className="size-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Follow-up members section */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">フォローが必要な会員</h2>
        <Suspense fallback={<div className="text-muted-foreground text-sm">読み込み中...</div>}>
          <FollowUpList />
        </Suspense>
      </div>
    </div>
  )
}
