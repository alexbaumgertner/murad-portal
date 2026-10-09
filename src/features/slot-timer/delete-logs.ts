import type { PayloadRequest } from 'payload'

/** Removes the slot logs of an enrollment (same transaction as the caller). */
export async function deleteLogs(req: PayloadRequest, enrollmentId: number): Promise<void> {
  await req.payload.delete({
    collection: 'slot-logs',
    where: { enrollment: { equals: enrollmentId } },
    overrideAccess: true,
    req,
  })
}
