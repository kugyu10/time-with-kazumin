/**
 * メニューをユーザーのプランタイプでフィルタする。
 * - allowed_plan_types === null -> 全プラン表示（後方互換）
 * - userPlanId が allowed_plan_types に含まれる -> 表示
 * - それ以外 -> 非表示
 */
export function filterMenusByPlanType<
  T extends { allowed_plan_types: number[] | null }
>(menus: T[], userPlanId: number | null): T[] {
  return menus.filter((menu) => {
    if (menu.allowed_plan_types === null) return true
    if (userPlanId === null) return false
    return menu.allowed_plan_types.includes(userPlanId)
  })
}
