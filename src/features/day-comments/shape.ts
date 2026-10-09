// Pure rules of the day comments (story 016). Shared by the collection, the service, the client
// form and unit tests. No framework imports.

import { isPausedOn, type PauseRange } from '@/features/enrollments/shape'
import { programDayOfDate } from '@/features/study-today/shape'

export const MAX_COMMENT_LENGTH = 1000

/** Where a calendar day stands against the enrollment: only today and past days can be commented. */
export type DayCheck = 'ok' | 'future_day' | 'invalid_day' | 'paused_day'

/**
 * Can `date` (`YYYY-MM-DD`) be commented? Days before program day 1 and after the program's last
 * day are not days of the enrollment; days after `today` have not happened yet (AC 5); a calendar
 * day inside a pause is not a day of the program either (story 017).
 */
export function checkDay(input: {
  date: string
  startDate: string
  today: string
  totalDays: number
  pauses?: readonly PauseRange[]
}): DayCheck {
  const { date, startDate, today, totalDays, pauses = [] } = input
  const day = programDayOfDate(startDate, date, pauses)
  if (day < 1 || day > totalDays) return 'invalid_day'
  if (isPausedOn(pauses, date)) return 'paused_day'
  return date > today ? 'future_day' : 'ok'
}
