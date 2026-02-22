import { getPlans } from "@/lib/actions/admin/plans"
import { PlansClient } from "./plans-client"

export default async function PlansPage() {
  const plans = await getPlans()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">プラン管理</h1>
          <p className="text-muted-foreground mt-2">
            サブスクリプションプランの作成・編集・削除ができます
          </p>
        </div>
      </div>

      <PlansClient initialPlans={plans} />
    </div>
  )
}
