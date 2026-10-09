import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { programDayOfDate, type DayProgress } from '@/features/study-today/shape'

import { dayProgressOf, type LoggedSlot } from './shape'

export type SlotLogs = {
  /** What was logged by program day, in the shape story 013's day states read. */
  progress: Map<number, DayProgress>
  /** The slots logged on each program day, for the per-slot status of a past day. */
  byDay: Map<number, LoggedSlot[]>
}

/**
 * The signed-in student's slot logs of one enrollment, by program day (story 014). Read as her
 * (`overrideAccess: false`): the collection only returns the logs of her own enrollments.
 */
export async function getSlotLogs(
  payload: Payload,
  student: TypedUser,
  enrollment: { id: number; startDate: string; template: { slots: { minutes: number }[] }[] },
): Promise<SlotLogs> {
  const { docs } = await payload.find({
    collection: 'slot-logs',
    where: { enrollment: { equals: enrollment.id } },
    pagination: false,
    depth: 0,
    select: { date: true, slotIndex: true, minutes: true, completed: true },
    overrideAccess: false,
    user: student,
  })

  const byDay = new Map<number, LoggedSlot[]>()
  for (const doc of docs) {
    const day = programDayOfDate(enrollment.startDate, doc.date)
    byDay.set(day, [
      ...(byDay.get(day) ?? []),
      { slotIndex: doc.slotIndex, minutes: doc.minutes, completed: doc.completed },
    ])
  }

  const progress = new Map<number, DayProgress>()
  for (const [day, logged] of byDay) {
    const slots = enrollment.template[(day - 1) % enrollment.template.length]?.slots ?? []
    const entry = dayProgressOf(slots, logged)
    if (entry) progress.set(day, entry)
  }
  return { progress, byDay }
}
