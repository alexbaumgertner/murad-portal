import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { OPEN_STATUSES, timeZoneOrDefault } from './shape'

export type StartResult = { ok: true; started: boolean } | { ok: false; error: 'not_found' }

/**
 * «Начать»: turns the student's assigned enrollment active from today in her zone. Runs as the
 * student (`overrideAccess: false`): the collection only lets her start her own, still assigned
 * enrollment, and its hook sets the date on the server. A second tap finds it active and changes
 * nothing (AC 7).
 */
export async function startEnrollment(
  payload: Payload,
  student: TypedUser,
  timezone: string,
): Promise<StartResult> {
  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { student: { equals: student.id }, status: { in: [...OPEN_STATUSES] } },
    sort: '-assignedAt',
    limit: 1,
    depth: 0,
    overrideAccess: false,
    user: student,
  })
  const enrollment = docs[0]
  if (!enrollment) return { ok: false, error: 'not_found' }
  if (enrollment.status !== 'assigned') return { ok: true, started: false }

  const { docs: updated } = await payload.update({
    collection: 'enrollments',
    // The status condition makes a racing second tap match nothing instead of starting again.
    where: { id: { equals: enrollment.id }, status: { equals: 'assigned' } },
    data: { status: 'active', timezone: timeZoneOrDefault(timezone) },
    depth: 0,
    overrideAccess: false,
    user: student,
  })
  return { ok: true, started: updated.length > 0 }
}
