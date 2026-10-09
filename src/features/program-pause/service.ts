import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { addDays, dateOnlyToISO, programDay, todayIn } from '@/features/enrollments/shape'
import { stopTimer } from '@/features/slot-timer/service'
import { isOver } from '@/features/study-today/shape'
import { contentDefaultLocale } from '@/i18n/locales'
import type { Enrollment, Program } from '@/payload-types'

/**
 * Pause and resume (story 017, D-SP-4). The browser sends nothing: the enrollment is the
 * signed-in student's own (read as her, `overrideAccess: false`) and the dates are the server's, in
 * her zone. The write itself is trusted code, not a visitor write — a student has no write access
 * to `status` or `pauses` — so it runs with `overrideAccess: true` and the `pauseTransition`
 * context the collection hook checks. There is no limit on the length or the number of pauses (Q6).
 */

export type PauseError = 'no_program' | 'program_over' | 'not_paused'
export type PauseResult =
  { ok: true; changed: boolean; programSlug: string } | { ok: false; error: PauseError }

type Pause = NonNullable<Enrollment['pauses']>[number]

async function findOpen(payload: Payload, student: TypedUser) {
  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { student: { equals: student.id }, status: { in: ['active', 'paused'] } },
    sort: '-assignedAt',
    limit: 1,
    depth: 1,
    locale: student.locale === 'en' ? 'en' : 'ru',
    fallbackLocale: contentDefaultLocale,
    overrideAccess: false,
    user: student,
  })
  const enrollment = docs[0]
  if (!enrollment?.startDate || !enrollment.timezone || typeof enrollment.program !== 'object') {
    return null
  }
  return { enrollment, program: enrollment.program as Program, timezone: enrollment.timezone }
}

/**
 * The write behind both buttons. Payload finds the matching rows first and then updates each one,
 * so two taps at once can both get through the `where`: the second one then meets the new status
 * in the hook and is refused, or rewrites the same pauses. Either way the result is one change,
 * so a refusal is read back and is not an error when the enrollment is already as asked.
 */
async function transition(
  payload: Payload,
  id: number,
  from: 'active' | 'paused',
  data: { status: 'active' | 'paused'; pauses: Pause[] },
): Promise<boolean> {
  const { docs, errors } = await payload.update({
    collection: 'enrollments',
    where: { id: { equals: id }, status: { equals: from } },
    data,
    depth: 0,
    overrideAccess: true,
    context: { pauseTransition: true, disableRevalidate: true },
  })
  if (errors.length === 0) return docs.length > 0
  const now = await payload.findByID({
    collection: 'enrollments',
    id,
    depth: 0,
    overrideAccess: true,
  })
  if (now.status === data.status) return false
  throw new Error(`changing the status failed: ${errors[0]?.message}`)
}

const keep = (pauses: Enrollment['pauses']): Pause[] =>
  (pauses ?? []).map(({ from, to }) => ({ from, to: to ?? null }))

/**
 * «Пауза»: today in her zone is the first paused day (AC 1). A timer that is running is stopped and
 * saved first (AC 5). Pausing a paused enrollment changes nothing, so a double tap is harmless.
 */
export async function pauseProgram(
  payload: Payload,
  student: TypedUser,
  now: Date = new Date(),
): Promise<PauseResult> {
  const found = await findOpen(payload, student)
  if (!found) return { ok: false, error: 'no_program' }
  const { enrollment, program, timezone } = found
  const programSlug = program.slug
  if (enrollment.status === 'paused') return { ok: true, changed: false, programSlug }

  const day = programDay(enrollment.startDate!, timezone, now, enrollment.pauses)
  if (isOver(day, program.durationWeeks)) return { ok: false, error: 'program_over' }

  await stopTimer(payload, student, now) // saves the running run before the day stops counting

  const today = todayIn(timezone, now)
  const changed = await transition(payload, enrollment.id, 'active', {
    status: 'paused',
    pauses: [...keep(enrollment.pauses), { from: dateOnlyToISO(today), to: null }],
  })
  return { ok: true, changed, programSlug }
}

/**
 * «Продолжить»: the open pause ends yesterday and today is the program day she stopped on (AC 2).
 * A pause begun and ended on the same day leaves no record (AC 6).
 */
export async function resumeProgram(
  payload: Payload,
  student: TypedUser,
  now: Date = new Date(),
): Promise<PauseResult> {
  const found = await findOpen(payload, student)
  if (!found) return { ok: false, error: 'no_program' }
  const { enrollment, program, timezone } = found
  const programSlug = program.slug
  if (enrollment.status !== 'paused') return { ok: false, error: 'not_paused' }

  const today = todayIn(timezone, now)
  const yesterday = addDays(today, -1)
  const pauses = keep(enrollment.pauses)
  const open = pauses.findLastIndex((pause) => !pause.to)
  const next = pauses.flatMap((pause, index) => {
    if (index !== open) return [pause]
    return pause.from.slice(0, 10) > yesterday
      ? []
      : [{ from: pause.from, to: dateOnlyToISO(yesterday) }]
  })

  const changed = await transition(payload, enrollment.id, 'paused', {
    status: 'active',
    pauses: next,
  })
  return { ok: true, changed, programSlug }
}
