'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useId } from 'react'

import { inviteStudentAction } from '@/features/students/actions'
import { initialInviteState, type InviteError } from '@/features/students/schema'

import styles from './InviteStudent.module.css'

// The admin UI is English-only, so its copy stays here rather than in messages/*.
const errorMessages: Record<InviteError, string> = {
  invalid_email: 'Enter a valid email address.',
  invalid_name: 'The name can be at most 80 characters.',
  already_invited: 'This address already has an account.',
  forbidden: 'Only the owner can invite students.',
  mail_failed: 'Could not send the invite email, so no account was created. Try again later.',
}

/** "Invite a student" above the users list: creates a student and emails her a link to /login. */
export function InviteStudent() {
  const [state, formAction, isPending] = useActionState(inviteStudentAction, initialInviteState)
  const router = useRouter()
  const emailId = useId()
  const nameId = useId()
  const statusId = useId()

  useEffect(() => {
    // Show the new student in the list below.
    if (state.status === 'success') router.refresh()
  }, [state, router])

  const error = state.status === 'error' ? state.error : null

  return (
    <section className={styles.panel} aria-labelledby={`${statusId}-title`}>
      <h2 id={`${statusId}-title`} className={styles.title}>
        Invite a student
      </h2>
      <form action={formAction} className={styles.form} noValidate>
        <div className={styles.field}>
          <label htmlFor={emailId} className={styles.label}>
            Student email
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="off"
            required
            className={styles.input}
            aria-invalid={error === 'invalid_email' || error === 'already_invited'}
            aria-describedby={statusId}
            disabled={isPending}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={nameId} className={styles.label}>
            Name (optional)
          </label>
          <input
            id={nameId}
            name="name"
            type="text"
            maxLength={80}
            autoComplete="off"
            className={styles.input}
            aria-invalid={error === 'invalid_name'}
            disabled={isPending}
          />
        </div>
        <button
          type="submit"
          className="btn btn--style-primary btn--size-medium"
          disabled={isPending}
        >
          {isPending ? 'Inviting…' : 'Invite'}
        </button>
      </form>
      <p
        id={statusId}
        className={error ? styles.error : styles.success}
        role={error ? 'alert' : 'status'}
      >
        {error ? errorMessages[error] : null}
        {state.status === 'success'
          ? `Invited ${state.email}. The invite email is on its way.`
          : null}
      </p>
    </section>
  )
}
