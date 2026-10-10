import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { programDay, resolvePauses, todayIn, type PauseRange } from '@/features/enrollments/shape'
import { getSlotLogs } from '@/features/slot-timer/queries'
import type { LoggedSlot } from '@/features/slot-timer/shape'
import { contentDefaultLocale } from '@/i18n/locales'
import type { Enrollment, Program, SlotType } from '@/payload-types'

import { finishEnrollment } from './service'
import { isOver, totalDaysOf, type DayProgress } from './shape'

export type SlotView = { name: string; description: string | null; minutes: number }

export type StudyOverview =
  | { kind: 'none' }
  | {
      kind: 'ready'
      /** `finished` also when the last day has just passed (the enrollment was closed now). */
      status: 'active' | 'paused' | 'finished'
      programTitle: string
      levelFrom: string
      levelTo: string
      durationWeeks: number
      totalDays: number
      /** `YYYY-MM-DD` of program day 1. */
      startDate: string
      /** Program day of today in the enrollment's zone; may exceed `totalDays`. */
      today: number
      /** The pauses as calendar ranges; an open one lasts through `todayDate` (story 017). */
      pauses: PauseRange[]
      /** `YYYY-MM-DD` of today in the enrollment's zone. */
      todayDate: string
      /** First day of the pause she is in now; `null` when she is not paused. */
      pausedSince: string | null
      /** The 7 template days with their slots, the same for every week. */
      template: { slots: SlotView[] }[]
      /** Logged days by program day (story 014: from `slot-logs`). */
      progress: Map<number, DayProgress>
      /** The logged slots of each program day: «25 из 40 мин» on a past day. */
      logs: Map<number, LoggedSlot[]>
    }

export function templateOf(program: Program): { slots: SlotView[] }[] {
  return program.weekTemplate.map((day) => ({
    slots: (day.slots ?? []).flatMap((slot) => {
      const type = slot.slotType as SlotType | number
      if (typeof type !== 'object') return []
      return [
        {
          name: type.name,
          description: type.description?.trim() || null,
          minutes: slot.minMinutes ?? type.defaultMinMinutes,
        },
      ]
    }),
  }))
}

async function findEnrollment(payload: Payload, student: TypedUser, locale: 'ru' | 'en') {
  const find = async (statuses: Enrollment['status'][]) => {
    const { docs } = await payload.find({
      collection: 'enrollments',
      where: { student: { equals: student.id }, status: { in: statuses } },
      sort: '-assignedAt',
      limit: 1,
      depth: 2,
      locale,
      fallbackLocale: contentDefaultLocale,
      overrideAccess: false,
      user: student,
    })
    return docs[0]
  }
  // A started program wins; a finished one is shown only while nothing newer is open.
  return (await find(['active', 'paused'])) ?? (await find(['finished']))
}

/**
 * What «Сегодня» and the week list need about the signed-in student's started program (story
 * 013). Read as her (`overrideAccess: false`): only her own enrollment, a published program, no
 * placement note. A program whose last day has passed is closed here (AC 8).
 */
export async function getStudyOverview(
  payload: Payload,
  student: TypedUser,
  locale: 'ru' | 'en',
  now: Date = new Date(),
): Promise<StudyOverview> {
  const enrollment = await findEnrollment(payload, student, locale)
  if (!enrollment || typeof enrollment.program !== 'object') return { kind: 'none' }
  if (!enrollment.startDate || !enrollment.timezone) return { kind: 'none' }

  const program = enrollment.program
  const today = programDay(enrollment.startDate, enrollment.timezone, now, enrollment.pauses)
  const todayDate = todayIn(enrollment.timezone, now)
  const pauses = resolvePauses(enrollment.pauses, todayDate)
  let status: 'active' | 'paused' | 'finished' = enrollment.status as
    'active' | 'paused' | 'finished'
  // `today` already leaves out the paused days; a paused enrollment is never closed here (story 017).
  if (status === 'active' && isOver(today, program.durationWeeks)) {
    await finishEnrollment(payload, enrollment.id)
    status = 'finished'
  }

  const template = templateOf(program)
  const startDate = enrollment.startDate.slice(0, 10)
  const { progress, byDay } = await getSlotLogs(payload, student, {
    id: enrollment.id,
    startDate,
    template,
    pauses,
  })

  return {
    kind: 'ready',
    status,
    programTitle: program.title,
    levelFrom: program.levelFrom,
    levelTo: program.levelTo,
    durationWeeks: program.durationWeeks,
    totalDays: totalDaysOf(program.durationWeeks),
    startDate,
    today,
    pauses,
    todayDate,
    pausedSince:
      status === 'paused'
        ? (enrollment.pauses?.findLast((pause) => !pause.to)?.from.slice(0, 10) ?? null)
        : null,
    template,
    progress,
    logs: byDay,
  }
}
