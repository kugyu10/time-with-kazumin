import { getMembers } from "@/lib/actions/admin/members"
import { getPlans } from "@/lib/actions/admin/plans"
import { MembersClient } from "./members-client"

export default async function MembersPage() {
  const [members, plans] = await Promise.all([
    getMembers(),
    getPlans(),
  ])

  // Filter active plans for member creation
  const activePlans = plans
    .filter((p) => p.is_active)
    .map((p) => ({
      id: p.id,
      name: p.name,
      monthly_points: p.monthly_points,
    }))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">会員管理</h1>
          <p className="text-muted-foreground mt-2">
            会員の登録・退会処理やポイント調整ができます
          </p>
        </div>
      </div>

      <MembersClient initialMembers={members} plans={activePlans} />
    </div>
  )
}
