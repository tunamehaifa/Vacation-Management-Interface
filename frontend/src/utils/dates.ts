/**
 * Vacation dates are calendar days, "YYYY-MM-DD", with no time and no time
 * zone. They are handled as UTC midnights so no conversion can shift a day.
 */

const parse = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`)

/** Today in the user's own calendar, "YYYY-MM-DD". */
export function todayIso(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function addDays(isoDate: string, days: number): string {
  const date = parse(isoDate)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Number of vacation days, both ends included: 3 Nov – 5 Nov is 3 days. */
export function daysInclusive(startDate: string, endDate: string): number {
  return Math.round((parse(endDate).getTime() - parse(startDate).getTime()) / 86_400_000) + 1
}

const displayFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** "2026-11-03" → "3 Nov 2026" */
export const formatDate = (isoDate: string) => displayFormat.format(parse(isoDate))

/** First day of the month containing `isoDate`: "2026-11-17" → "2026-11-01". */
export const monthStart = (isoDate: string) => `${isoDate.slice(0, 7)}-01`

/** Last day of that month: "2026-11-17" → "2026-11-30". */
export const monthEnd = (isoDate: string) => addDays(addMonths(monthStart(isoDate), 1), -1)

/** The first of the month, `months` months later: addMonths("2026-11-17", 1) → "2026-12-01". */
export function addMonths(isoDate: string, months: number): string {
  const date = parse(monthStart(isoDate))
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.toISOString().slice(0, 10)
}

/** Every day from `from` to `to`, both included. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day)
  return days
}

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (isoDate: string) => parse(isoDate).getUTCDay()

const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** "2026-11-01" → "November 2026" */
export const formatMonth = (isoDate: string) => monthFormat.format(parse(isoDate))
