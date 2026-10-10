// Pure rules of an enrollment (story 012): placement scales, statuses, time zones and the program day.
// Shared by the collection, the student page and unit tests. No framework imports.

import { LEVELS, isLevel, type Level } from '@/features/programs/shape'

export const ENROLLMENT_STATUSES = ['assigned', 'active', 'paused', 'finished'] as const
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number]
/** A student has at most one enrollment in one of these at a time (D-SP-6). */
export const OPEN_STATUSES = ['assigned', 'active', 'paused'] as const satisfies EnrollmentStatus[]

export const isOpenStatus = (value: unknown): boolean =>
  typeof value === 'string' && (OPEN_STATUSES as readonly string[]).includes(value)

export const PLACEMENT_TESTS = [
  'murad',
  'ielts',
  'toefl',
  'cambridge',
  'duolingo',
  'pte',
  'efset',
  'other',
] as const
export type PlacementTest = (typeof PLACEMENT_TESTS)[number]

export const CAMBRIDGE_EXAMS = ['KET', 'PET', 'FCE', 'CAE', 'CPE'] as const

/** Brand names stay as they are in every locale; Murad's own test and «Other» are translated. */
export const TEST_NAMES: Record<Exclude<PlacementTest, 'murad' | 'other'>, string> = {
  ielts: 'IELTS',
  toefl: 'TOEFL iBT',
  cambridge: 'Cambridge',
  duolingo: 'Duolingo English Test',
  pte: 'PTE Academic',
  efset: 'EF SET',
}

type Scale = { min: number; max: number; step: number; message: string }

/** Each test's own scale (D-SP-9). Murad's CEFR test has no score, «Other» a free-text one. */
export const SCALES: Record<Exclude<PlacementTest, 'murad' | 'other'>, Scale> = {
  ielts: { min: 0, max: 9, step: 0.5, message: 'IELTS: балл от 0 до 9 с шагом 0,5' },
  toefl: { min: 0, max: 120, step: 1, message: 'TOEFL iBT: балл от 0 до 120' },
  cambridge: { min: 80, max: 230, step: 1, message: 'Cambridge: балл от 80 до 230' },
  duolingo: {
    min: 10,
    max: 160,
    step: 5,
    message: 'Duolingo English Test: балл от 10 до 160 с шагом 5',
  },
  pte: { min: 10, max: 90, step: 1, message: 'PTE Academic: балл от 10 до 90' },
  efset: { min: 0, max: 100, step: 1, message: 'EF SET: балл от 0 до 100' },
}

export const MAX_TEST_NAME = 60
export const MAX_SCORE_TEXT = 40
export const MAX_NOTE = 500

export const DEFAULT_TIMEZONE = 'Asia/Almaty'

export const messages = {
  examRequired: 'Cambridge: выберите экзамен (KET, PET, FCE, CAE, CPE)',
  testName: `Название теста: от 1 до ${MAX_TEST_NAME} символов`,
  scoreText: `Результат: не больше ${MAX_SCORE_TEXT} символов`,
  cefr: 'Уровень CEFR: выберите от A1 до C2',
  takenAtFuture: 'Дата теста: не позже сегодняшнего дня',
  alreadyOpen: (title: string) => `У ученика уже есть программа: ${title}`,
  notPublished: 'Назначить можно только опубликованную программу',
  programLocked: 'Программу можно сменить, только пока ученик не начал',
  notStudent: 'Программу можно назначить только ученику',
  statusChange: 'Владелец может только завершить программу; начинает её ученик',
  levelAbove: (cefr: string) => `Уровень по тесту (${cefr}) выше программы`,
} as const

export const hasScore = (test: unknown): test is keyof typeof SCALES =>
  typeof test === 'string' && test in SCALES

/** Null when the score fits the test's scale, otherwise a message naming the test and its range. */
export function scoreError(test: unknown, score: unknown): string | null {
  if (!hasScore(test)) return null
  const scale = SCALES[test]
  const ok =
    typeof score === 'number' &&
    Number.isFinite(score) &&
    score >= scale.min &&
    score <= scale.max &&
    Number.isInteger((score - scale.min) / scale.step)
  return ok ? null : scale.message
}

/** `YYYY-MM-DD` of `now` on the wall clock of `timeZone`. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** The latest calendar date anywhere on Earth: a test taken "today" in any zone is not in the future. */
export const latestToday = (now: Date = new Date()): string => todayIn('Pacific/Kiritimati', now)

export function isTakenAtValid(takenAt: unknown, now: Date = new Date()): boolean {
  if (takenAt == null || takenAt === '') return true // `required` reports a missing date
  const date = new Date(takenAt as string)
  if (Number.isNaN(date.getTime())) return false
  return date.toISOString().slice(0, 10) <= latestToday(now)
}

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** The zone the browser reports, or Almaty when it reports nothing usable (AC 5). */
export const timeZoneOrDefault = (value: unknown): string =>
  isTimeZone(value) ? value : DEFAULT_TIMEZONE

/** `YYYY-MM-DD` stored as UTC midnight, so the calendar date survives the timestamp column. */
export const dateOnlyToISO = (ymd: string): string => `${ymd}T00:00:00.000Z`

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole calendar days from `from` to `to` (both `YYYY-MM-DD` or ISO). */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(...ymdParts(from))
  const b = Date.UTC(...ymdParts(to))
  return Math.round((b - a) / DAY_MS)
}

function ymdParts(value: string): [number, number, number] {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return [y ?? 1970, (m ?? 1) - 1, d ?? 1]
}

/** `YYYY-MM-DD` that is `days` calendar days after `date` (negative: before). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = ymdParts(date)
  return new Date(Date.UTC(y, m, d + days)).toISOString().slice(0, 10)
}

/** A pause as stored (story 017): the first paused day and the last one, `null` while it lasts. */
export type StoredPause = { from: string; to?: string | null }
/** A pause with both ends known (`YYYY-MM-DD`, both days paused). */
export type PauseRange = { from: string; to: string }

/**
 * The pauses as sorted, merged calendar ranges. A pause that is still open lasts through `today`
 * (the day it started is paused too); a range that ends before it starts is dropped.
 */
export function resolvePauses(
  pauses: readonly StoredPause[] | null | undefined,
  today: string,
): PauseRange[] {
  const ranges = (pauses ?? [])
    .map((pause) => ({
      from: pause.from.slice(0, 10),
      to: pause.to ? pause.to.slice(0, 10) : today,
    }))
    .filter((range) => range.from <= range.to)
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
  const merged: PauseRange[] = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range.from <= addDays(last.to, 1)) {
      if (range.to > last.to) last.to = range.to
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

/** Is `date` (`YYYY-MM-DD`) a paused calendar day? */
export const isPausedOn = (ranges: readonly PauseRange[], date: string): boolean =>
  ranges.some((range) => range.from <= date && date <= range.to)

/** Paused calendar days strictly before `date`. */
export function pausedDaysBefore(ranges: readonly PauseRange[], date: string): number {
  const lastDay = addDays(date, -1)
  let count = 0
  for (const range of ranges) {
    if (range.from > lastDay) continue
    count += daysBetween(range.from, range.to < lastDay ? range.to : lastDay) + 1
  }
  return count
}

/**
 * Program day of the calendar date `date`: `(date − start) − pausedDaysBefore(date) + 1`. A paused
 * date has the number of the day it interrupted, the same as the first day after the pause.
 */
export function programDayOnDate(
  startDate: string,
  date: string,
  ranges: readonly PauseRange[] = [],
): number {
  return daysBetween(startDate, date) - pausedDaysBefore(ranges, date) + 1
}

/** The calendar date on which program day `day` is studied: after every pause that began before it. */
export function dateOfProgramDay(
  startDate: string,
  day: number,
  ranges: readonly PauseRange[] = [],
): string {
  let offset = day - 1
  for (const range of ranges) {
    if (addDays(startDate, offset) >= range.from) offset += daysBetween(range.from, range.to) + 1
  }
  return addDays(startDate, offset)
}

/**
 * Day 1 is the start date in the student's zone (D-SP-3). Paused days are not counted (story 017,
 * `dayIndex = (today − startDate) − pausedDaysBefore(today) + 1`): during a pause and on the day
 * it ends the number stays where it stopped.
 */
export function programDay(
  startDate: string,
  timeZone: string,
  now: Date = new Date(),
  pauses?: readonly StoredPause[] | null,
): number {
  const today = todayIn(timeZone, now)
  return programDayOnDate(startDate, today, resolvePauses(pauses, today))
}

/** True when the placement level is above the level the program starts from (AC 11, a warning only). */
export function placementAboveProgram(cefr: unknown, levelFrom: unknown): cefr is Level {
  return isLevel(cefr) && isLevel(levelFrom) && LEVELS.indexOf(cefr) > LEVELS.indexOf(levelFrom)
}

/** Score as the student sees it: IELTS «4.5», Cambridge «FCE 175», Other — the free text. */
export function scoreLabel(placement: {
  test?: string | null
  score?: number | null
  exam?: string | null
  scoreText?: string | null
}): string | null {
  if (placement.test === 'other') return placement.scoreText?.trim() || null
  if (!hasScore(placement.test) || placement.score == null) return null
  if (placement.test === 'cambridge' && placement.exam) {
    return `${placement.exam} ${placement.score}`
  }
  return String(placement.score)
}
