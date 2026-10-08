import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { isOwner } from '@/access'

/**
 * The signed-in admin behind a request, or null. Verification is Payload's own `auth()` with the
 * `indie_session` strategy (signature, expiry and a user that still exists). Every user of this
 * site is invited; only `role: 'owner'` is an admin, a student is signed in but not an admin.
 */
export async function currentAdmin(payload: Payload, headers: Headers): Promise<TypedUser | null> {
  try {
    const { user } = await payload.auth({ headers })
    return user && isOwner(user) ? user : null
  } catch {
    return null
  }
}
