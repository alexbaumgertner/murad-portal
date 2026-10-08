import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { captureServerError } from '@/lib/monitoring/server'

import { InviteEmailError } from './send-invite'
import type { InviteInput } from './schema'

export type InviteResult =
  { ok: true; email: string } | { ok: false; error: 'already_invited' | 'mail_failed' }

/**
 * Creates a student account on behalf of the owner. The role is fixed here, never taken from
 * input, so the invite flow cannot mint another owner. The users hook stamps `invitedAt` and
 * sends the invite inside the same transaction: if the email fails, no account is left behind.
 */
export async function inviteStudent(
  payload: Payload,
  input: InviteInput,
  owner: TypedUser,
): Promise<InviteResult> {
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: { email: { equals: input.email } },
    overrideAccess: false,
    user: owner,
  })
  if (totalDocs > 0) return { ok: false, error: 'already_invited' }

  try {
    await payload.create({
      collection: 'users',
      data: { email: input.email, name: input.name, role: 'student' },
      overrideAccess: false,
      user: owner,
      depth: 0,
    })
  } catch (error) {
    if (!(error instanceof InviteEmailError)) throw error
    console.error('[students] invite email failed', error.cause)
    await captureServerError(error, 'students-invite')
    return { ok: false, error: 'mail_failed' }
  }
  return { ok: true, email: input.email }
}
