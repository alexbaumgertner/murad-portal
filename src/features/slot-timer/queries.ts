import 'server-only'

import type { Payload, TypedUser } from 'payload'

import type { PauseRange } from '@/features/enrollments/shape'
import type { DayProgress } from '@/features/study-today/shape'

import { groupSlotLogs, type LoggedSlot } from './shape'

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
  enrollment: {
    id: number
    startDate: string
    template: { slots: { minutes: number }[] }[]
    /** Resolved pauses (story 017): a paused day has the number of the day it interrupted. */
    pauses?: readonly PauseRange[]
  },
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

  return groupSlotLogs(docs, enrollment)
}
