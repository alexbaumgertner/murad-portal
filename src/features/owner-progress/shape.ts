// Pure rules of the owner's progress page (story 019): the numbers of one student, built from her
// enrollment and slot logs with the same rules she sees on /study. No framework imports.

import {
  programDayOnDate,
  resolvePauses,
  todayIn,
  type EnrollmentStatus,
  type PauseRange,
  type StoredPause,
} from '@/features/enrollments/shape'
import { groupSlotLogs } from '@/features/slot-timer/shape'
import {
  progressTotals,
  totalDaysOf,
  type DayProgress,
  type TemplateDay,
  type Totals,
} from '@/features/study-today/shape'

export type LogDoc = { date: string; slotIndex: number; minutes: number; completed: boolean }

export type StudentSummary = {
  enrollmentId: number
  name: string
  programTitle: string
  levelFrom: string
  levelTo: string
  status: EnrollmentStatus
  /** Program day of today in her zone; `null` until she presses «Начать». */
  today: number | null
  totalDays: number
  /** `null` for an assigned program: nothing to count yet. */
  totals: Totals | null
  /** `YYYY-MM-DD` of the newest day with minutes, or `null`. */
  lastStudyDate: string | null
  /** `YYYY-MM-DD` of program day 1, or `null`. */
  startDate: string | null
  todayDate: string | null
  pauses: PauseRange[]
  progress: Map<number, DayProgress>
}

export type EnrollmentFacts = {
  id: number
  status: EnrollmentStatus
  name: string
  programTitle: string
  levelFrom: string
  levelTo: string
  durationWeeks: number
  startDate: string | null
  timezone: string | null
  pauses?: readonly StoredPause[] | null
}

/** The newest `YYYY-MM-DD` among logs that hold minutes. */
export function latestStudyDate(logs: readonly LogDoc[]): string | null {
  let latest: string | null = null
  for (const log of logs) {
    if (log.minutes <= 0) continue
    const date = log.date.slice(0, 10)
    if (!latest || date > latest) latest = date
  }
  return latest
}

/**
 * One student's numbers as of `now`. «Today» is the program day in her zone, pause-aware (story
 * 017), exactly as on her own page; a program that is not started has no day and no totals.
 */
export function summarize(input: {
  enrollment: EnrollmentFacts
  template: TemplateDay[]
  logs: readonly LogDoc[]
  now: Date
}): StudentSummary {
  const { enrollment, template, logs, now } = input
  const totalDays = totalDaysOf(enrollment.durationWeeks)
  const common = {
    enrollmentId: enrollment.id,
    name: enrollment.name,
    programTitle: enrollment.programTitle,
    levelFrom: enrollment.levelFrom,
    levelTo: enrollment.levelTo,
    totalDays,
  }
  if (!enrollment.startDate || !enrollment.timezone) {
    return {
      ...common,
      status: enrollment.status,
      today: null,
      totals: null,
      lastStudyDate: null,
      startDate: null,
      todayDate: null,
      pauses: [],
      progress: new Map(),
    }
  }

  const startDate = enrollment.startDate.slice(0, 10)
  const todayDate = todayIn(enrollment.timezone, now)
  const pauses = resolvePauses(enrollment.pauses, todayDate)
  const today = programDayOnDate(startDate, todayDate, pauses)
  const { progress } = groupSlotLogs(logs, { startDate, template, pauses })
  // Her own page closes a program past its last day the next time she opens it; here nothing is
  // written (story 019, AC 7), so an active program that is over is shown as finished.
  const status =
    enrollment.status === 'active' && today > totalDays ? 'finished' : enrollment.status
  return {
    ...common,
    status,
    today,
    totals: progressTotals({ today, totalDays, template, progress }),
    lastStudyDate: latestStudyDate(logs),
    startDate,
    todayDate,
    pauses,
    progress,
  }
}
