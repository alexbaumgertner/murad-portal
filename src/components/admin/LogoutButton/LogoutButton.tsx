'use client'

import { useTransition } from 'react'

import { logoutAction } from '@/features/auth/actions'

import styles from './LogoutButton.module.css'

/** Clears the email-code session cookie; Payload's own logout only knows its JWT cookie. */
export function LogoutButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      className={styles.button}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await logoutAction()
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Full reload clears Payload's client-side auth state after logout.
          window.location.assign('/admin/login')
        })
      }
    >
      {isPending ? 'Logging out…' : 'Log out'}
    </button>
  )
}
