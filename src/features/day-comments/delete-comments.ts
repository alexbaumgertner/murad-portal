import type { PayloadRequest } from 'payload'

/** Removes the day comments of an enrollment (same transaction as the caller). */
export async function deleteComments(req: PayloadRequest, enrollmentId: number): Promise<void> {
  await req.payload.delete({
    collection: 'day-comments',
    where: { enrollment: { equals: enrollmentId } },
    overrideAccess: true,
    req,
  })
}
