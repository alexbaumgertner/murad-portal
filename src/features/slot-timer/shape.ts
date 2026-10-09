// Pure rules of the slot timer (story 014, D-SP-4 / D-SP-7): elapsed time, the 4-hour cap, when a
// slot counts as done. Shared by the service, the client timer and unit tests. No framework imports.

import type { DayProgress } from '@/features/study-today/shape'

export const MAX_TIMER_MINUTES = 240
export const MAX_SLOT_MINUTES = 600
export const MAX_SLOT_INDEX = 4

const MINUTE_MS = 60_000

/** Time since `startedAt`, never negative and never more than the 4-hour cap (D-SP-4). */
export function elapsedMs(startedAt: string, now: Date): number {
  const ms = now.getTime() - new Date(startedAt).getTime()
  return Math.min(Math.max(ms, 0), MAX_TIMER_MINUTES * MINUTE_MS)
}

/** True when the timer has run past the cap and must be stopped (AC 7). */
export const isExpired = (startedAt: string, now: Date) =>
  now.getTime() - new Date(startedAt).getTime() > MAX_TIMER_MINUTES * MINUTE_MS

/** Whole minutes a stop adds: rounded down, but at least 1 once 30 seconds have passed (AC 3). */
export function addedMinutes(ms: number): number {
  const whole = Math.floor(ms / MINUTE_MS)
  return whole === 0 && ms >= 30_000 ? 1 : whole
}

/** Saved minutes after a stop, never above a slot's limit. */
export const addToSaved = (saved: number, ms: number) =>
  Math.min(MAX_SLOT_MINUTES, saved + addedMinutes(ms))

/** Saved + running time has reached the slot's minimum (AC 2). */
export function isReached(input: {
  saved: number
  startedAt: string | null
  now: Date
  minimum: number
}): boolean {
  const { saved, startedAt, now, minimum } = input
  const running = startedAt ? elapsedMs(startedAt, now) : 0
  return saved * MINUTE_MS + running >= minimum * MINUTE_MS
}

export const MINUTES_BUCKETS = ['<15', '15–30', '30–60', '60+'] as const
export type MinutesBucket = (typeof MINUTES_BUCKETS)[number]

/** Coarse minutes for analytics (epic): never the exact value. */
export function minutesBucket(minutes: number): MinutesBucket {
  if (minutes < 15) return '<15'
  if (minutes < 30) return '15–30'
  if (minutes < 60) return '30–60'
  return '60+'
}

export type LoggedSlot = { slotIndex: number; minutes: number; completed: boolean }

/**
 * What one program day looks like from its logs (feeds story 013's states): done only when every
 * slot of the template is completed (D-SP-7), `undefined` when nothing was logged.
 */
export function dayProgressOf(
  slots: { minutes: number }[],
  logs: LoggedSlot[],
): DayProgress | undefined {
  if (logs.length === 0) return undefined
  const minutes = logs.reduce((sum, log) => sum + log.minutes, 0)
  const done =
    slots.length > 0 &&
    slots.every((_, index) => logs.some((log) => log.slotIndex === index && log.completed))
  return { done, minutes }
}

/** What the browser shows for one slot; the server is the source of truth (D-SP-4). */
export type TimerSlotState = {
  index: number
  minutes: number
  completed: boolean
  /** ISO time the running timer started; null when stopped. */
  startedAt: string | null
}

/** A timer left running from an earlier calendar day (AC 8): shown so it can be stopped. */
export type CarriedTimer = { name: string; startedAt: string }

export type TimerState = {
  /** The server clock at the time of the answer: the browser counts from it, not from its own. */
  serverNow: string
  slots: TimerSlotState[]
  carried: CarriedTimer | null
}
