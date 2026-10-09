import 'server-only'

import type { Payload, TypedUser } from 'payload'

/**
 * The signed-in student's own comments by calendar day (`YYYY-MM-DD` → text). Read as her
 * (`overrideAccess: false`): the collection only returns comments of her own enrollments.
 */
export async function getDayComments(
  payload: Payload,
  student: TypedUser,
): Promise<Map<string, string>> {
  const { docs } = await payload.find({
    collection: 'day-comments',
    pagination: false,
    depth: 0,
    select: { date: true, text: true },
    overrideAccess: false,
    user: student,
  })
  return new Map(docs.map((doc) => [doc.date.slice(0, 10), doc.text]))
}
