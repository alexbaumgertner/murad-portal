import 'server-only'

import type { Payload } from 'payload'

/**
 * Closes a program whose last day has passed (story 013, AC 8). Not a visitor write: the id comes
 * from an enrollment the student already read and the status is derived from the date, so it runs
 * without access checks — a student may not set `finished` herself, only the owner can. The
 * `status` condition makes a second page load a no-op.
 */
export async function finishEnrollment(payload: Payload, enrollmentId: number): Promise<void> {
  await payload.update({
    collection: 'enrollments',
    where: { id: { equals: enrollmentId }, status: { in: ['active', 'paused'] } },
    data: { status: 'finished' },
    depth: 0,
    overrideAccess: true,
    context: { disableRevalidate: true },
  })
}
