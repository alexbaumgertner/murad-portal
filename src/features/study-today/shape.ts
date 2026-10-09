// Pure rules of «Сегодня» and the week grid (story 013): which program day a calendar date is,
// the state of each day, and the progress numbers. Shared by the pages and unit tests.
// No framework imports.

import { daysBetween } from '@/features/enrollments/shape'
import { PLAN_DAYS } from '@/features/program-plan/shape'

export const DAY_STATES = [
  'done',
  'partial',
  'missed',
  'today',
  'paused',
  'rest',
  'upcoming',
] as const
export type DayState = (typeof DAY_STATES)[number]

/** Never colour alone (epic): every state has a marker; «upcoming» is deliberately empty. */
export const DAY_MARKERS: Record<DayState, string> = {
  done: '✓',
  partial: '½',
  missed: '✕',
  today: '●',
  paused: '‖',
  rest: '—',
  upcoming: '',
}

/** What was logged on one program day (story 015 fills it; until then nothing is logged). */
export type DayProgress = { done: boolean; minutes: number }

export type TemplateDay = { slots: { minutes: number }[] }

/** Template day (1–7) of a program day (1-based): the week template repeats (D-SP-3). */
export const templateDayOf = (programDay: number) => ((programDay - 1) % PLAN_DAYS) + 1

export const weekOf = (programDay: number) => Math.ceil(programDay / PLAN_DAYS)

/** First program day of a week (1-based). */
export const firstDayOfWeek = (week: number) => (week - 1) * PLAN_DAYS + 1

export const totalDaysOf = (durationWeeks: number) => durationWeeks * PLAN_DAYS

/** Past the last program day: the program is finished (epic, «Program day calculation»). */
export const isOver = (programDay: number, durationWeeks: number) =>
  programDay > totalDaysOf(durationWeeks)

/** `YYYY-MM-DD` of program day `programDay` when day 1 is `startDate`. */
export function dateOfDay(startDate: string, programDay: number): string {
  const [y = 1970, m = 1, d = 1] = startDate.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + programDay - 1)).toISOString().slice(0, 10)
}

/** Weekday and day-of-month of a `YYYY-MM-DD` date, formatted for `locale` without time zones. */
export function formatCalendarDate(date: string, locale: string) {
  const at = new Date(`${date}T12:00:00.000Z`)
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(at)
  return {
    weekday: part({ weekday: 'short' }),
    dayOfMonth: part({ day: 'numeric' }),
    long: part({ weekday: 'long', day: 'numeric', month: 'long' }),
  }
}

const isRest = (template: TemplateDay[], programDay: number) =>
  (template[templateDayOf(programDay) - 1]?.slots.length ?? 0) === 0

/**
 * State of one program day. `today` is the program day of «now» (it may exceed the program's
 * length). A past day with a rest template is «rest», not «missed»; a paused calendar day is
 * «paused» (story 017 supplies `paused`).
 */
export function dayState(input: {
  programDay: number
  today: number
  template: TemplateDay[]
  progress?: DayProgress
  paused?: boolean
}): DayState {
  const { programDay, today, template, progress, paused } = input
  if (paused) return 'paused'
  if (isRest(template, programDay)) return programDay === today ? 'today' : 'rest'
  if (progress?.done) return 'done'
  if (programDay === today) return 'today'
  if (programDay > today) return 'upcoming'
  return progress && progress.minutes > 0 ? 'partial' : 'missed'
}

export type Totals = { done: number; missed: number; minutes: number }

/**
 * The three header numbers. Only days before `today` can be missed, and rest and paused days
 * never are; a partial day counts as missed in the total because it was not completed.
 */
export function progressTotals(input: {
  today: number
  totalDays: number
  template: TemplateDay[]
  progress: ReadonlyMap<number, DayProgress>
  pausedDays?: ReadonlySet<number>
}): Totals {
  const { today, totalDays, template, progress, pausedDays } = input
  const last = Math.min(today - 1, totalDays)
  let done = 0
  let missed = 0
  let minutes = 0
  for (const entry of progress.values()) minutes += entry.minutes
  for (let day = 1; day <= last; day += 1) {
    if (pausedDays?.has(day) || isRest(template, day)) continue
    if (progress.get(day)?.done) done += 1
    else missed += 1
  }
  return { done, missed, minutes }
}

export type WeekCell = {
  programDay: number
  /** 1–7 within the week. */
  day: number
  date: string
  state: DayState
}

/** The 7 cells of `week`: program day, calendar date and state. */
export function weekCells(input: {
  week: number
  startDate: string
  today: number
  template: TemplateDay[]
  progress: ReadonlyMap<number, DayProgress>
  pausedDays?: ReadonlySet<number>
}): WeekCell[] {
  const { week, startDate, today, template, progress, pausedDays } = input
  return Array.from({ length: PLAN_DAYS }, (_, i) => {
    const programDay = firstDayOfWeek(week) + i
    return {
      programDay,
      day: i + 1,
      date: dateOfDay(startDate, programDay),
      state: dayState({
        programDay,
        today,
        template,
        progress: progress.get(programDay),
        paused: pausedDays?.has(programDay),
      }),
    }
  })
}

/** «Done / total» of a week for the week list: days that count (not rest, not paused) in it. */
export function weekCount(input: {
  week: number
  template: TemplateDay[]
  progress: ReadonlyMap<number, DayProgress>
  pausedDays?: ReadonlySet<number>
}): { done: number; total: number } {
  const { week, template, progress, pausedDays } = input
  let done = 0
  let total = 0
  for (let i = 0; i < PLAN_DAYS; i += 1) {
    const programDay = firstDayOfWeek(week) + i
    if (pausedDays?.has(programDay) || isRest(template, programDay)) continue
    total += 1
    if (progress.get(programDay)?.done) done += 1
  }
  return { done, total }
}

/** Training days (not rest) in the whole program: the "total" the finished screen compares with. */
export function trainingDaysIn(durationWeeks: number, template: TemplateDay[]): number {
  const perWeek = template.filter((day) => day.slots.length > 0).length
  return perWeek * durationWeeks
}

/** Days from `startDate` to the calendar date `date`, + 1: day number of any calendar date. */
export const programDayOfDate = (startDate: string, date: string) =>
  daysBetween(startDate, date) + 1
