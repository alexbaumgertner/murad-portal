import 'server-only'

import type { Payload, TypedUser } from 'payload'

import {
  dateOnlyToISO,
  isPausedOn,
  programDay,
  resolvePauses,
  todayIn,
  type PauseRange,
} from '@/features/enrollments/shape'
import { contentDefaultLocale } from '@/i18n/locales'
import type { Enrollment, Program, SlotLog, SlotType } from '@/payload-types'
import { dateOfDay, isOver, programDayOfDate, templateDayOf } from '@/features/study-today/shape'

import {
  MAX_SLOT_INDEX,
  MAX_SLOT_MINUTES,
  addToSaved,
  elapsedMs,
  isExpired,
  isReached,
  type TimerState,
} from './shape'

/**
 * The slot timer (story 014, D-SP-4 / D-SP-7). The browser only says "start slot N" or "stop";
 * the server owns the clock, the date and the minutes. Writes use `overrideAccess: true` because a
 * student has no write access to `slot-logs` at all (see the collection): every call here first
 * derives the enrollment from the signed-in student and never takes one from the input.
 */

export type CompletedSlot = { slotTypeId: number; minutes: number }
export type TimerError =
  'no_program' | 'invalid_slot' | 'program_over' | 'forbidden' | 'paused' | 'too_many_minutes'
export type TimerResult =
  { ok: true; state: TimerState; completedNow: CompletedSlot[] } | { ok: false; error: TimerError }

type SlotDef = { slotTypeId: number; name: string; minutes: number }
type Context = {
  student: TypedUser
  enrollment: Enrollment
  startDate: string
  timezone: string
  durationWeeks: number
  /** The 7 template days with their slots. */
  template: SlotDef[][]
}

/** The pauses of her enrollment as calendar ranges, an open one through today (story 017). */
const pausesOf = (ctx: Context, now: Date): PauseRange[] =>
  resolvePauses(ctx.enrollment.pauses, todayIn(ctx.timezone, now))

/** Program day of today: paused days are not counted. */
const dayOfToday = (ctx: Context, now: Date) =>
  programDay(ctx.startDate, ctx.timezone, now, ctx.enrollment.pauses)

const idOf = (value: number | { id: number }) => (typeof value === 'object' ? value.id : value)

function templateOf(program: Program): SlotDef[][] {
  return program.weekTemplate.map((day) =>
    (day.slots ?? []).flatMap((slot) => {
      const type = slot.slotType as SlotType | number
      if (typeof type !== 'object') return []
      return [
        {
          slotTypeId: type.id,
          name: type.name,
          minutes: slot.minMinutes ?? type.defaultMinMinutes,
        },
      ]
    }),
  )
}

async function loadContext(
  payload: Payload,
  student: TypedUser,
  statuses: Enrollment['status'][][],
): Promise<Context | null> {
  const locale = student.locale === 'en' ? 'en' : 'ru'
  for (const group of statuses) {
    const { docs } = await payload.find({
      collection: 'enrollments',
      where: { student: { equals: student.id }, status: { in: group } },
      sort: '-assignedAt',
      limit: 1,
      depth: 2,
      locale,
      fallbackLocale: contentDefaultLocale,
      overrideAccess: false,
      user: student,
    })
    const enrollment = docs[0]
    if (!enrollment || typeof enrollment.program !== 'object') continue
    if (!enrollment.startDate || !enrollment.timezone) continue
    return {
      student,
      enrollment,
      startDate: enrollment.startDate.slice(0, 10),
      timezone: enrollment.timezone,
      durationWeeks: enrollment.program.durationWeeks,
      template: templateOf(enrollment.program),
    }
  }
  return null
}

/** Starting needs a running program (a paused one answers `paused`); stopping and reading also work on a paused or just finished one. */
const forStart = (payload: Payload, student: TypedUser) =>
  loadContext(payload, student, [['active', 'paused']])
const forAny = (payload: Payload, student: TypedUser) =>
  loadContext(payload, student, [['active', 'paused'], ['finished']])

const slotsOnDate = (ctx: Context, date: string, now: Date) =>
  ctx.template[templateDayOf(programDayOfDate(ctx.startDate, date, pausesOf(ctx, now))) - 1] ?? []

async function findRunning(payload: Payload, ctx: Context): Promise<SlotLog | undefined> {
  const { docs } = await payload.find({
    collection: 'slot-logs',
    where: { enrollment: { equals: ctx.enrollment.id }, timerStartedAt: { exists: true } },
    sort: 'timerStartedAt',
    limit: 1,
    depth: 0,
    overrideAccess: false,
    user: ctx.student,
  })
  return docs[0]
}

const slotTypeOf = (log: SlotLog) => idOf(log.slotType)

/**
 * Brings the running timer up to date. With `stop` (or past the 4-hour cap) the whole run is added
 * and the timer cleared; otherwise it only flags the slot as completed once the minimum is
 * reached, and keeps running (AC 2). The update is conditional on the timer start, so a double tap
 * or a second tab changes the state once.
 */
async function settleRunning(
  payload: Payload,
  ctx: Context,
  now: Date,
  stop: boolean,
): Promise<CompletedSlot[]> {
  const log = await findRunning(payload, ctx)
  const startedAt = log?.timerStartedAt
  if (!log || !startedAt) return []
  const date = log.date.slice(0, 10)
  const minimum = slotsOnDate(ctx, date, now)[log.slotIndex]?.minutes ?? Infinity
  const guard = { id: { equals: log.id }, timerStartedAt: { equals: startedAt } }

  if (stop || isExpired(startedAt, now)) {
    const minutes = addToSaved(log.minutes, elapsedMs(startedAt, now))
    const completed = log.completed || minutes >= minimum
    const { docs } = await payload.update({
      collection: 'slot-logs',
      where: guard,
      data: { minutes, completed, timerStartedAt: null },
      depth: 0,
      overrideAccess: true,
    })
    return docs.length > 0 && completed && !log.completed
      ? [{ slotTypeId: slotTypeOf(log), minutes }]
      : []
  }

  if (!log.completed && isReached({ saved: log.minutes, startedAt, now, minimum })) {
    const { docs } = await payload.update({
      collection: 'slot-logs',
      where: guard,
      data: { completed: true },
      depth: 0,
      overrideAccess: true,
    })
    return docs.length > 0 ? [{ slotTypeId: slotTypeOf(log), minutes: minimum }] : []
  }
  return []
}

async function buildState(payload: Payload, ctx: Context, now: Date): Promise<TimerState> {
  const today = todayIn(ctx.timezone, now)
  const todayDay = dayOfToday(ctx, now)
  // No slots to run on a paused day (story 017, AC 7).
  const open =
    ctx.enrollment.status !== 'paused' && !isOver(todayDay, ctx.durationWeeks) && todayDay >= 1
  const slots = open ? slotsOnDate(ctx, today, now) : []

  const { docs } = await payload.find({
    collection: 'slot-logs',
    where: {
      enrollment: { equals: ctx.enrollment.id },
      or: [{ date: { equals: dateOnlyToISO(today) } }, { timerStartedAt: { exists: true } }],
    },
    pagination: false,
    depth: 0,
    overrideAccess: false,
    user: ctx.student,
  })

  const carriedLog = docs.find((log) => log.timerStartedAt && log.date.slice(0, 10) !== today)
  return {
    serverNow: now.toISOString(),
    slots: slots.map((_, index) => {
      const log = docs.find((doc) => doc.date.slice(0, 10) === today && doc.slotIndex === index)
      return {
        index,
        minutes: log?.minutes ?? 0,
        completed: log?.completed ?? false,
        startedAt: log?.timerStartedAt ?? null,
      }
    }),
    carried: carriedLog?.timerStartedAt
      ? {
          name:
            slotsOnDate(ctx, carriedLog.date.slice(0, 10), now)[carriedLog.slotIndex]?.name ?? '',
          startedAt: carriedLog.timerStartedAt,
        }
      : null,
  }
}

/** The state of today's slots; also settles an expired timer and flags a reached minimum (AC 5, 7). */
export async function getTimerState(
  payload: Payload,
  student: TypedUser,
  now: Date = new Date(),
): Promise<TimerResult> {
  const ctx = await forAny(payload, student)
  if (!ctx) return { ok: false, error: 'no_program' }
  const completedNow = await settleRunning(payload, ctx, now, false)
  return { ok: true, state: await buildState(payload, ctx, now), completedNow }
}

/** Same as the state, named for the browser's check when its own counter passes the minimum. */
export const syncTimer = getTimerState

/**
 * «Старт» on slot `slotIndex` of today (the date is the server's, in the enrollment's zone). A
 * timer running on another slot is stopped and saved first: one at a time (AC 6). Starting the slot
 * that is already running changes nothing (AC 10).
 */
export async function startTimer(
  payload: Payload,
  student: TypedUser,
  slotIndex: number,
  now: Date = new Date(),
): Promise<TimerResult> {
  const ctx = await forStart(payload, student)
  if (!ctx) return { ok: false, error: 'no_program' }
  if (ctx.enrollment.status === 'paused') return { ok: false, error: 'paused' }
  const day = dayOfToday(ctx, now)
  if (isOver(day, ctx.durationWeeks)) return { ok: false, error: 'program_over' }
  const today = todayIn(ctx.timezone, now)
  const slot =
    Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex <= MAX_SLOT_INDEX
      ? slotsOnDate(ctx, today, now)[slotIndex]
      : undefined
  if (!slot) return { ok: false, error: 'invalid_slot' }

  const date = dateOnlyToISO(today)
  const running = await findRunning(payload, ctx)
  const alreadyRunning = running?.date.slice(0, 10) === today && running.slotIndex === slotIndex
  const completedNow =
    running && !alreadyRunning ? await settleRunning(payload, ctx, now, true) : []

  if (!alreadyRunning) {
    const find = async () =>
      (
        await payload.find({
          collection: 'slot-logs',
          where: {
            enrollment: { equals: ctx.enrollment.id },
            date: { equals: date },
            slotIndex: { equals: slotIndex },
          },
          limit: 1,
          depth: 0,
          overrideAccess: false,
          user: ctx.student,
        })
      ).docs[0]
    const startedAt = now.toISOString()
    const existing = await find()
    if (existing) {
      // A second tab that got here first has already started it: leave its start time.
      if (!existing.timerStartedAt) {
        await payload.update({
          collection: 'slot-logs',
          where: { id: { equals: existing.id }, timerStartedAt: { exists: false } },
          data: { timerStartedAt: startedAt },
          depth: 0,
          overrideAccess: true,
        })
      }
    } else {
      try {
        await payload.create({
          collection: 'slot-logs',
          data: {
            enrollment: ctx.enrollment.id,
            date,
            slotIndex,
            slotType: slot.slotTypeId,
            minutes: 0,
            completed: false,
            timerStartedAt: startedAt,
          },
          depth: 0,
          overrideAccess: true,
        })
      } catch (error) {
        // The unique (enrollment, date, slot) index: a double tap created it a moment ago.
        if (!(await find())) throw error
      }
    }
  }
  return { ok: true, state: await buildState(payload, ctx, now), completedNow }
}

/** «Стоп»: adds the whole minutes of the run, rounded down (AC 3). Nothing running is not an error. */
export async function stopTimer(
  payload: Payload,
  student: TypedUser,
  now: Date = new Date(),
): Promise<TimerResult> {
  const ctx = await forAny(payload, student)
  if (!ctx) return { ok: false, error: 'no_program' }
  const completedNow = await settleRunning(payload, ctx, now, true)
  return { ok: true, state: await buildState(payload, ctx, now), completedNow }
}

/**
 * «Отметить вручную» (story 015): sets the minutes of one slot of today or an earlier program day,
 * replacing what was there (a repeat updates, never duplicates). The slot is done only at its
 * minimum (D-SP-7); 0 resets it. A timer running on this very slot is stopped by the same write,
 * the manual value replaces the total; a timer on another slot is left alone. Future days and days
 * before the start are refused. The day in a pause (story 017) is refused here as soon as that
 * story supplies the pause days; today a paused enrollment is refused as a whole.
 */
export async function markSlot(
  payload: Payload,
  student: TypedUser,
  input: { programDay: number; slotIndex: number; minutes: number },
  now: Date = new Date(),
): Promise<TimerResult> {
  const ctx = await forAny(payload, student)
  if (!ctx) return { ok: false, error: 'no_program' }
  if (ctx.enrollment.status === 'paused') return { ok: false, error: 'paused' }
  const today = dayOfToday(ctx, now)
  if (ctx.enrollment.status === 'finished' || isOver(today, ctx.durationWeeks)) {
    return { ok: false, error: 'program_over' }
  }

  const { programDay: day, slotIndex, minutes } = input
  if (!Number.isInteger(day) || day < 1 || day > today) return { ok: false, error: 'forbidden' }
  if (!Number.isInteger(minutes) || minutes < 0) return { ok: false, error: 'forbidden' }
  if (minutes > MAX_SLOT_MINUTES) return { ok: false, error: 'too_many_minutes' }
  const ranges = pausesOf(ctx, now)
  const date = dateOfDay(ctx.startDate, day, ranges)
  // A program day is never a paused calendar day; the check keeps it so if the mapping changes.
  if (isPausedOn(ranges, date)) return { ok: false, error: 'paused' }
  const slot =
    Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex <= MAX_SLOT_INDEX
      ? slotsOnDate(ctx, date, now)[slotIndex]
      : undefined
  if (!slot) return { ok: false, error: 'invalid_slot' }

  const completed = minutes >= slot.minutes
  const dateISO = dateOnlyToISO(date)
  const find = async () =>
    (
      await payload.find({
        collection: 'slot-logs',
        where: {
          enrollment: { equals: ctx.enrollment.id },
          date: { equals: dateISO },
          slotIndex: { equals: slotIndex },
        },
        limit: 1,
        depth: 0,
        overrideAccess: false,
        user: ctx.student,
      })
    ).docs[0]
  const save = (log: SlotLog) =>
    payload.update({
      collection: 'slot-logs',
      id: log.id,
      data: { minutes, completed, timerStartedAt: null },
      depth: 0,
      overrideAccess: true,
    })

  let before = await find()
  if (before) {
    await save(before)
  } else if (minutes > 0) {
    try {
      await payload.create({
        collection: 'slot-logs',
        data: {
          enrollment: ctx.enrollment.id,
          date: dateISO,
          slotIndex,
          slotType: slot.slotTypeId,
          minutes,
          completed,
        },
        depth: 0,
        overrideAccess: true,
      })
    } catch (error) {
      // The unique (enrollment, date, slot) index: a double tap created it a moment ago.
      before = await find()
      if (!before) throw error
      await save(before)
    }
  }

  const completedNow: CompletedSlot[] =
    completed && !before?.completed ? [{ slotTypeId: slot.slotTypeId, minutes }] : []
  return { ok: true, state: await buildState(payload, ctx, now), completedNow }
}
