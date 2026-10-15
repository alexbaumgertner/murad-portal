// Pure rules of the weekly planner (story 022). Shared by collections, service, client and tests.
// Dates are `YYYY-MM-DD` strings; arithmetic runs on UTC noon so DST and time zones never shift a day.

export const MAX_ROWS = 40
export const MAX_TASK_TEXT = 500
export const DAYS = 7
/** The highest 0-based week index a planner may hold (about ten years of weeks). */
export const MAX_WEEK_INDEX = 520
export const MAX_DEADLINE_TITLE = 80
export const MAX_HEADER_TEXT = 80
export const MAX_SUBTITLE = 120
export const MAX_LABEL = 40
/** The owner's list of task types a student picks from (story 029). */
export const MAX_TASK_TYPES = 30
export const MAX_TASK_TYPE = 80
export const MAX_NOTE = 2000
export const NOTE_KINDS = ['exercises', 'questions'] as const
export type NoteKind = (typeof NOTE_KINDS)[number]

const NOON = 12

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d, NOON))
}

const toIso = (date: Date) => date.toISOString().slice(0, 10)

export const isIsoDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && toIso(toUtc(value)) === value

export function addDays(iso: string, days: number): string {
  const date = toUtc(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toIso(date)
}

/** Monday of the week that contains `iso`. */
export function mondayOf(iso: string): string {
  const sinceMonday = (toUtc(iso).getUTCDay() + 6) % 7
  return addDays(iso, -sinceMonday)
}

/** The seven dates (Monday first) of week `index` (0-based) counted from the base Monday. */
export function weekDates(baseDate: string, index: number): string[] {
  const monday = addDays(baseDate, index * DAYS)
  return Array.from({ length: DAYS }, (_, day) => addDays(monday, day))
}

const NUMERALS: [number, string][] = [
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

export function roman(value: number): string {
  let rest = value
  let out = ''
  for (const [size, symbol] of NUMERALS)
    while (rest >= size) {
      out += symbol
      rest -= size
    }
  return out
}

/** A cell counts as a task only with real text: not blank and not just dashes. */
export const isAssignedTask = (text: string | null | undefined): boolean => {
  const trimmed = (text ?? '').trim()
  return trimmed !== '' && !/^[-–—]+$/.test(trimmed)
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export const diffDays = (from: string, to: string): number =>
  Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000)

/** The saved list as plain strings; anything else in the JSON column is ignored. */
export function readTaskTypes(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

/**
 * What a student may pick: the owner's saved list, or, while there is none, the distinct tasks
 * already written in the planner (first appearance order).
 */
export function effectiveTaskTypes(saved: string[], existingTexts: string[]): string[] {
  if (saved.length > 0) return saved
  const seen = new Set<string>()
  for (const raw of existingTexts) if (isAssignedTask(raw)) seen.add(raw.trim())
  return [...seen]
}
