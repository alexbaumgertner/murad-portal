import 'server-only'

import type { Payload, TypedUser } from 'payload'

/**
 * The signed-in admin behind a request, or null. Verification is Payload's own `auth()` with the
 * `indie_session` strategy (signature, expiry and a user that still exists). Every user of this
 * site is an admin (`pnpm create-admin`); there is no sign-up and no role field.
 */
export async function currentAdmin(payload: Payload, headers: Headers): Promise<TypedUser | null> {
  try {
    const { user } = await payload.auth({ headers })
    return user?.collection === 'users' ? user : null
  } catch {
    return null
  }
}
