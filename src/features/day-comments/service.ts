import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { dateOnlyToISO, todayIn } from '@/features/enrollments/shape'
import { totalDaysOf } from '@/features/study-today/shape'
import type { Enrollment, Program } from '@/payload-types'

import { checkDay, MAX_COMMENT_LENGTH } from './shape'

/**
 * Saving a day comment (story 016). The browser names only the day and the text; the enrollment is
 * the signed-in student's own and "today" is the server's clock in her time zone. Writes use
 * `overrideAccess: true` because a student has no write access to `day-comments` at all (see the
 * collection) — every call first derives the enrollment and checks the day.
 */

export type SaveError = 'no_program' | 'future_day' | 'invalid_day' | 'too_long'
export type SaveResult = { ok: true; saved: boolean } | { ok: false; error: SaveError }

/** Her started program: the running one, else the one just finished (a past day stays commentable). */
async function findEnrollment(payload: Payload, student: TypedUser) {
  for (const statuses of [['active', 'paused'], ['finished']] as Enrollment['status'][][]) {
    const { docs } = await payload.find({
      collection: 'enrollments',
      where: { student: { equals: student.id }, status: { in: statuses } },
      sort: '-assignedAt',
      limit: 1,
      depth: 1,
      overrideAccess: false,
      user: student,
    })
    const enrollment = docs[0]
    if (enrollment?.startDate && enrollment.timezone && typeof enrollment.program === 'object') {
      return { enrollment, program: enrollment.program as Program }
    }
  }
  return null
}

/** Stores, replaces or (for empty text) deletes the comment of `date` on her own enrollment. */
export async function saveDayComment(
  payload: Payload,
  student: TypedUser,
  input: { date: string; text: string },
  now: Date = new Date(),
): Promise<SaveResult> {
  const text = input.text.trim()
  if (text.length > MAX_COMMENT_LENGTH) return { ok: false, error: 'too_long' }

  const found = await findEnrollment(payload, student)
  if (!found) return { ok: false, error: 'no_program' }
  const { enrollment, program } = found

  const day = checkDay({
    date: input.date,
    startDate: enrollment.startDate!.slice(0, 10),
    today: todayIn(enrollment.timezone!, now),
    totalDays: totalDaysOf(program.durationWeeks),
  })
  if (day !== 'ok') return { ok: false, error: day }

  const where = {
    enrollment: { equals: enrollment.id },
    date: { equals: dateOnlyToISO(input.date) },
  }
  if (!text) {
    await payload.delete({ collection: 'day-comments', where, overrideAccess: true })
    return { ok: true, saved: false }
  }

  const replace = async () => {
    const { docs } = await payload.update({
      collection: 'day-comments',
      where,
      data: { text },
      depth: 0,
      overrideAccess: true,
    })
    return docs.length > 0
  }
  if (await replace()) return { ok: true, saved: true }
  try {
    await payload.create({
      collection: 'day-comments',
      data: { enrollment: enrollment.id, date: dateOnlyToISO(input.date), text },
      depth: 0,
      overrideAccess: true,
    })
  } catch (error) {
    // A second save at the same moment created it first (unique per enrollment and date): replace.
    if (!(await replace())) throw error
  }
  return { ok: true, saved: true }
}
