/**
 * Activity status calculation for member follow-up
 * Separated from server actions (members.ts) because "use server" files
 * cannot export synchronous functions.
 */

export type ActivityStatus = 'normal' | 'yellow' | 'red'

/**
 * Calculate activity status based on last session date and future booking
 */
export function calcActivityStatus(
  lastSessionAt: string | null,
  hasFutureBooking: boolean
): ActivityStatus {
  if (hasFutureBooking) return 'normal'
  if (lastSessionAt === null) return 'red'
  const daysAgo = Math.floor(
    (Date.now() - new Date(lastSessionAt).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysAgo >= 60) return 'red'
  if (daysAgo >= 30) return 'yellow'
  return 'normal'
}
