/**
 * How a message's time reads, the way a messenger says it: the clock for
 * today, "Yesterday", the weekday within the last week, and a short date after
 * that. All in the reader's own locale and time zone.
 */

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Whole calendar days between `iso` and `now` (0 = today, 1 = yesterday). */
function daysAgo(iso: string, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY_MS)
}

/** "3:05 PM" - the time on a single message. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** The time beside a conversation in the list: "3:05 PM", "Yesterday", "Monday" or "3/10/26". */
export function listTime(iso: string, now = new Date()): string {
  const days = daysAgo(iso, now)
  if (days <= 0) return clockTime(iso)
  if (days === 1) return 'Yesterday'
  if (days < 7) return new Date(iso).toLocaleDateString(undefined, { weekday: 'long' })
  return new Date(iso).toLocaleDateString(undefined, {
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
  })
}

/** The divider above a day's messages: "Today", "Yesterday" or "Monday, March 10, 2026". */
export function dayLabel(iso: string, now = new Date()): string {
  const days = daysAgo(iso, now)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Whether two timestamps fall on the same calendar day, in the reader's zone. */
export function sameDay(a: string, b: string): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b))
}
