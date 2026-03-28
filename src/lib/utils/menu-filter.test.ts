import { describe, it, expect } from "vitest"
import { filterMenusByPlanType } from "./menu-filter"

describe("filterMenusByPlanType", () => {
  const menus = [
    { id: 1, name: "A", allowed_plan_types: null },
    { id: 2, name: "B", allowed_plan_types: [1] },
    { id: 3, name: "C", allowed_plan_types: [2] },
    { id: 4, name: "D", allowed_plan_types: [1, 2] },
  ]

  it("userPlanId=1 のとき: allowed_plan_types=null, [1], [1,2] のメニューが返る", () => {
    const result = filterMenusByPlanType(menus, 1)
    expect(result.map((m) => m.id)).toEqual([1, 2, 4])
  })

  it("userPlanId=2 のとき: allowed_plan_types=null, [2], [1,2] のメニューが返る", () => {
    const result = filterMenusByPlanType(menus, 2)
    expect(result.map((m) => m.id)).toEqual([1, 3, 4])
  })

  it("userPlanId=null のとき: allowed_plan_types=null のメニューのみ返る", () => {
    const result = filterMenusByPlanType(menus, null)
    expect(result.map((m) => m.id)).toEqual([1])
  })

  it("空配列を渡したとき空配列が返る", () => {
    const result = filterMenusByPlanType([], 1)
    expect(result).toEqual([])
  })

  it("allowed_plan_types に含まれないplan_idのメニューは除外される", () => {
    const result = filterMenusByPlanType(menus, 1)
    expect(result.map((m) => m.id)).not.toContain(3)
  })
})
