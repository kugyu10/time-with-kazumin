import { getFollowUpMembers } from "@/lib/actions/admin/members"
import type { Member } from "@/lib/actions/admin/members"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function formatLastSession(lastSessionAt: string | null): string {
  if (!lastSessionAt) return "未訪問"
  const daysAgo = Math.floor(
    (Date.now() - new Date(lastSessionAt).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysAgo === 0) return "今日"
  return `${daysAgo}日前`
}

function FollowUpSection({
  title,
  members,
  bgClass,
  titleClass,
}: {
  title: string
  members: Member[]
  bgClass: string
  titleClass: string
}) {
  if (members.length === 0) return null
  return (
    <div className="space-y-2">
      <h3 className={`font-semibold ${titleClass}`}>{title} ({members.length}名)</h3>
      <div className={`rounded-md border ${bgClass}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名前</TableHead>
              <TableHead>プラン</TableHead>
              <TableHead>前回セッション</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.full_name ?? m.email}</TableCell>
                <TableCell>{m.member_plan?.plan.name ?? "-"}</TableCell>
                <TableCell>{formatLastSession(m.last_session_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export async function FollowUpList() {
  const members = await getFollowUpMembers()

  const redMembers = members.filter(m => m.activity_status === 'red')
  const yellowMembers = members.filter(m => m.activity_status === 'yellow')

  if (redMembers.length === 0 && yellowMembers.length === 0) {
    return (
      <div className="text-muted-foreground text-sm">
        フォローが必要な会員はいません。
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <FollowUpSection
        title="60日以上未訪問"
        members={redMembers}
        bgClass="bg-red-50"
        titleClass="text-red-700"
      />
      <FollowUpSection
        title="30〜60日未訪問"
        members={yellowMembers}
        bgClass="bg-yellow-50"
        titleClass="text-yellow-700"
      />
    </div>
  )
}
