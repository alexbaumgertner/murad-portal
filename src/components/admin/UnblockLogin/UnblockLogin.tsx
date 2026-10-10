'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useActionState } from 'react'

import { unblockLoginAction } from '@/features/auth/actions'
import { initialUnblockState, type UnblockError } from '@/features/auth/schema'

import styles from './UnblockLogin.module.css'

// The admin UI is English-only, so its copy stays here rather than in messages/*.
const errorMessages: Record<UnblockError, string> = {
  forbidden: 'Only the owner can do this.',
  not_found: 'This user no longer exists.',
  server: 'Could not reset the login limits. Try again later.',
}

/**
 * "Reset login limits" on a user's page. Passwordless accounts never lock the way Payload's own
 * "Force Unlock" assumes; what blocks a user is the code rate limit, and this clears it.
 */
export function UnblockLogin() {
  const { id } = useDocumentInfo()
  const [state, formAction, isPending] = useActionState(
    unblockLoginAction.bind(null, id ?? ''),
    initialUnblockState,
  )

  if (!id) return null

  return (
    <div className={styles.panel}>
      <form action={formAction}>
        <button
          type="submit"
          className="btn btn--style-secondary btn--size-medium"
          disabled={isPending}
        >
          {isPending ? 'Resetting…' : 'Reset login limits'}
        </button>
      </form>
      <p className={styles.hint}>
        Use when the user cannot sign in: too many codes requested or too many wrong attempts. They
        can ask for a new code right away.
      </p>
      <p
        className={state.status === 'error' ? styles.error : styles.success}
        role={state.status === 'error' ? 'alert' : 'status'}
      >
        {state.status === 'error' ? errorMessages[state.error] : null}
        {state.status === 'success' ? 'Done. The user can request a new code now.' : null}
      </p>
    </div>
  )
}
