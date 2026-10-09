import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { OPEN_STATUSES, programDay } from '@/features/enrollments/shape'

import { groupWeek, taskText, weekOfDay, type PlanDayView } from './shape'

export type StudentWeekView =
  | { kind: 'none' }
  | {
      kind: 'plan'
      totalWeeks: number
      /** The week of today's program day; null before «Начать». */
      currentWeek: number | null
      week: number
      days: PlanDayView[]
    }

/**
 * One week of the signed-in student's personal plan (story 018), read-only. Read as her
 * (`overrideAccess: false`): the collection only returns tasks of her own enrollment. `week`
 * defaults to the current one and is clamped to the program.
 */
export async function getStudentWeek(
  payload: Payload,
  student: TypedUser,
  locale: 'ru' | 'en',
  week?: number,
): Promise<StudentWeekView> {
  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { student: { equals: student.id }, status: { in: [...OPEN_STATUSES] } },
    sort: '-assignedAt',
    limit: 1,
    depth: 1,
    select: { program: true, startDate: true, timezone: true },
    populate: { programs: { durationWeeks: true } },
    overrideAccess: false,
    user: student,
  })
  const enrollment = docs[0]
  if (!enrollment || typeof enrollment.program !== 'object') return { kind: 'none' }

  const totalWeeks = enrollment.program.durationWeeks
  const currentWeek =
    enrollment.startDate && enrollment.timezone
      ? Math.min(totalWeeks, weekOfDay(programDay(enrollment.startDate, enrollment.timezone)))
      : null
  const asked = week != null && Number.isInteger(week) ? week : (currentWeek ?? 1)
  const shown = Math.min(Math.max(asked, 1), totalWeeks)

  const { docs: items } = await payload.find({
    collection: 'student-assignments',
    where: { enrollment: { equals: enrollment.id }, week: { equals: shown } },
    sort: ['day', 'order'],
    pagination: false,
    depth: 0,
    select: { day: true, order: true, text: true },
    overrideAccess: false,
    user: student,
  })

  return {
    kind: 'plan',
    totalWeeks,
    currentWeek,
    week: shown,
    days: groupWeek(
      items.map((item) => ({
        id: item.id,
        day: item.day,
        order: item.order,
        text: taskText({ ru: item.text?.ru ?? '', en: item.text?.en }, locale),
      })),
      shown,
    ),
  }
}
