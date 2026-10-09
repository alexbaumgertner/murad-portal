// Pure rules of the day comments (story 016). Shared by the collection, the service, the client
// form and unit tests. No framework imports.

import { programDayOfDate } from '@/features/study-today/shape'

export const MAX_COMMENT_LENGTH = 1000

/** Where a calendar day stands against the enrollment: only today and past days can be commented. */
export type DayCheck = 'ok' | 'future_day' | 'invalid_day'

/**
 * Can `date` (`YYYY-MM-DD`) be commented? Days before program day 1 and after the program's last
 * day are not days of the enrollment; days after `today` have not happened yet (AC 5).
 */
export function checkDay(input: {
  date: string
  startDate: string
  today: string
  totalDays: number
}): DayCheck {
  const { date, startDate, today, totalDays } = input
  const day = programDayOfDate(startDate, date)
  if (day < 1 || day > totalDays) return 'invalid_day'
  return date > today ? 'future_day' : 'ok'
}
