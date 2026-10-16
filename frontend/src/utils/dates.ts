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
