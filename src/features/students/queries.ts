import 'server-only'

import type { Payload, TypedUser } from 'payload'

import type { Level } from '@/features/programs/shape'

export type StudentCard = {
  name: string | null
  email: string
  level: Level | null
  goal: string | null
  /** `YYYY-MM-DD`: the day Murad tested her level (her latest enrollment's placement). */
  startedAt: string | null
  avatarUrl: string | null
}

// Payload may prefix the file URL with the server origin; the page wants a same-origin path.
function relativeUrl(url: string): string {
  const { pathname, search } = new URL(url, 'http://localhost')
  return `${pathname}${search}`
}

/**
 * What her card on /study shows. Read as her (`overrideAccess: false`): her own record, her own
 * enrollment and her own avatar only; anything she may not read comes back as null.
 */
export async function getStudentCard(payload: Payload, student: TypedUser): Promise<StudentCard> {
  const user = await payload.findByID({
    collection: 'users',
    id: student.id,
    depth: 1,
    overrideAccess: false,
    user: student,
  })
  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { student: { equals: student.id } },
    sort: '-assignedAt',
    limit: 1,
    depth: 0,
    overrideAccess: false,
    user: student,
  })
  const takenAt = docs[0]?.placement?.takenAt
  const avatar = typeof user.avatar === 'object' && user.avatar ? user.avatar : null

  return {
    name: user.name?.trim() || null,
    email: user.email,
    level: user.level ?? null,
    goal: user.goal?.trim() || null,
    startedAt: takenAt ? takenAt.slice(0, 10) : null,
    avatarUrl: avatar?.url ? relativeUrl(avatar.url) : null,
  }
}
