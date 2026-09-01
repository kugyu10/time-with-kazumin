/**
 * 予約重複判定（バッファ適用）
 *
 * 読み取り経路（src/app/api/public/slots/week/route.ts L217-223）は既存予約に
 * 前後バッファを足した範囲でスロットを隠している。書き込み経路が素の重なり判定の
 * ままだと「UIには出ないが直接POSTすると通る」枠が残るため、同じ判定をここに集約して
 * ゲスト・会員の両経路から呼ぶ。
 *
 * 注意: DBの no_overlapping_bookings EXCLUDE 制約はバッファを知らない。
 * バッファ分の重なりを止められるのはこの関数だけで、EXCLUDE 制約が拾うのは
 * 素の重なりのみ。
 */

import { getSupabaseServiceRole } from "@/lib/supabase/service-role"
import {
  getBufferAfterMinutes,
  getBufferBeforeMinutes,
} from "@/lib/settings/app-settings"

export type ConflictCheckResult =
  | { status: "available" }
  | { status: "conflict" }
  | { status: "error"; message: string }

/**
 * 指定区間がバッファ込みで既存予約と重ならないか判定する
 *
 * 既存予約は [start - bufferBefore, end + bufferAfter] を占有するとみなす。
 * 重なり条件 (booking.start - before < newEnd) && (booking.end + after > newStart) を
 * 定数側に寄せて (booking.start < newEnd + before) && (booking.end > newStart - after) で問い合わせる。
 *
 * RLSにより会員クライアントでは他人の予約が見えないため service role を使う。
 *
 * @param excludeBookingId 除外する予約ID（振替など、自分自身との重複を無視したい場合）
 */
export async function checkBookingConflict(
  startTime: string,
  endTime: string,
  excludeBookingId?: number
): Promise<ConflictCheckResult> {
  const [bufferBeforeMinutes, bufferAfterMinutes] = await Promise.all([
    getBufferBeforeMinutes(),
    getBufferAfterMinutes(),
  ])

  const bufferBeforeMs = bufferBeforeMinutes * 60 * 1000
  const bufferAfterMs = bufferAfterMinutes * 60 * 1000

  const rangeEnd = new Date(new Date(endTime).getTime() + bufferBeforeMs).toISOString()
  const rangeStart = new Date(new Date(startTime).getTime() - bufferAfterMs).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (getSupabaseServiceRole() as any)
    .from("bookings")
    .select("id")
    .neq("status", "canceled")
    .lt("start_time", rangeEnd)
    .gt("end_time", rangeStart)
    .limit(1)

  if (excludeBookingId !== undefined) {
    query = query.neq("id", excludeBookingId)
  }

  const { data, error } = (await query) as {
    data: Array<{ id: number }> | null
    error: { message: string } | null
  }

  if (error) {
    console.error("[Conflicts] Booking conflict check failed:", error)
    return { status: "error", message: error.message }
  }

  return data && data.length > 0 ? { status: "conflict" } : { status: "available" }
}
