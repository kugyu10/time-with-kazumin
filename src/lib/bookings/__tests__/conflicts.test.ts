/**
 * 予約重複判定（バッファ適用）のユニットテスト
 *
 * 検証の中心は「DBに投げるクエリ範囲がバッファぶん広がっているか」。
 * 読み取り側 (slots/week) は既存予約を [start - before, end + after] とみなして
 * スロットを隠すので、書き込み側の問い合わせ範囲がそれと一致している必要がある。
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// --- モックはSUTのimportより前に置く（vi.mockのホイスティング前提） ---

/** 直近の .lt("start_time", x) / .gt("end_time", y) を記録する */
const lastQuery: { lt?: string; gt?: string; neqId?: number } = {}
let conflictRows: Array<{ id: number }> = []
let queryError: { message: string } | null = null

vi.mock("@/lib/supabase/service-role", () => ({
  getSupabaseServiceRole: vi.fn(() => ({
    from: () => ({
      select: () => ({
        neq: () => {
          const builder = {
            lt: (_c: string, v: string) => {
              lastQuery.lt = v
              return builder
            },
            gt: (_c: string, v: string) => {
              lastQuery.gt = v
              return builder
            },
            limit: () => builder,
            neq: (_c: string, v: number) => {
              lastQuery.neqId = v
              return builder
            },
            then: (
              resolve: (r: {
                data: Array<{ id: number }> | null
                error: { message: string } | null
              }) => unknown
            ) => resolve({ data: queryError ? null : conflictRows, error: queryError }),
          }
          return builder
        },
      }),
    }),
  })),
}))

const bufferBefore = vi.fn().mockResolvedValue(30)
const bufferAfter = vi.fn().mockResolvedValue(0)
vi.mock("@/lib/settings/app-settings", () => ({
  getBufferBeforeMinutes: () => bufferBefore(),
  getBufferAfterMinutes: () => bufferAfter(),
}))

import { checkBookingConflict } from "../conflicts"

const START = "2026-09-10T01:00:00.000Z" // JST 10:00
const END = "2026-09-10T01:30:00.000Z" // JST 10:30

describe("checkBookingConflict()", () => {
  beforeEach(() => {
    conflictRows = []
    queryError = null
    delete lastQuery.lt
    delete lastQuery.gt
    delete lastQuery.neqId
    bufferBefore.mockResolvedValue(30)
    bufferAfter.mockResolvedValue(0)
  })

  it("Test 1: 重複がなければ available", async () => {
    const result = await checkBookingConflict(START, END)
    expect(result).toEqual({ status: "available" })
  })

  it("Test 2: 重複があれば conflict", async () => {
    conflictRows = [{ id: 1 }]
    const result = await checkBookingConflict(START, END)
    expect(result).toEqual({ status: "conflict" })
  })

  it("Test 3: DBエラーは error として返し、呼び出し側に判断を委ねる", async () => {
    queryError = { message: "boom" }
    const result = await checkBookingConflict(START, END)
    expect(result).toEqual({ status: "error", message: "boom" })
  })

  it("Test 4: 前バッファぶん検索範囲の終端が広がる", async () => {
    // before=30分 → booking.start < end + 30min を問い合わせる。
    // これがないと「10:30終了の直後10:30開始」を弾けず、UIが隠す枠を書き込めてしまう。
    await checkBookingConflict(START, END)
    expect(lastQuery.lt).toBe("2026-09-10T02:00:00.000Z")
    expect(lastQuery.gt).toBe(START)
  })

  it("Test 5: 後バッファぶん検索範囲の始端が広がる", async () => {
    bufferAfter.mockResolvedValue(15)
    await checkBookingConflict(START, END)
    expect(lastQuery.gt).toBe("2026-09-10T00:45:00.000Z")
  })

  it("Test 6: バッファ0なら素の重なり判定と一致する", async () => {
    bufferBefore.mockResolvedValue(0)
    await checkBookingConflict(START, END)
    expect(lastQuery.lt).toBe(END)
    expect(lastQuery.gt).toBe(START)
  })

  it("Test 7: excludeBookingId を渡すと自分自身を除外する", async () => {
    await checkBookingConflict(START, END, 42)
    expect(lastQuery.neqId).toBe(42)
  })
})
