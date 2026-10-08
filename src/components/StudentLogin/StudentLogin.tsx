'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useActionState, useEffect, useId } from 'react'

import { loginAction } from '@/features/auth/actions'
import { CODE_LENGTH, initialLoginState } from '@/features/auth/schema'

import styles from './StudentLogin.module.css'

/** Public sign-in for invited students: email → 6-digit code → /study (story 011). */
export function StudentLogin() {
  const t = useTranslations('Login')
  const locale = useLocale()
  const [state, formAction, isPending] = useActionState(loginAction, initialLoginState)
  const emailId = useId()
  const codeId = useId()
  const errorId = useId()

  useEffect(() => {
    // Full navigation: the session cookie is new, and the owner is sent on to /admin.
    if (state.step === 'done') window.location.assign(state.redirectTo)
  }, [state])

  if (state.step === 'done') {
    return (
      <p className={styles.hint} role="status">
        {t('done')}
      </p>
    )
  }

  const error = state.error

  return (
    <form action={formAction} className={styles.form} noValidate>
      <input type="hidden" name="locale" value={locale} />

      {state.step === 'email' ? (
        <>
          <div className={styles.field}>
            <label htmlFor={emailId} className={styles.label}>
              {t('emailLabel')}
            </label>
            <input
              id={emailId}
              name="email"
              type="email"
              defaultValue={state.email}
              autoComplete="email"
              inputMode="email"
              required
              className={styles.input}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              disabled={isPending}
            />
          </div>
          <button
            type="submit"
            name="intent"
            value="request"
            className={styles.button}
            disabled={isPending}
          >
            {isPending ? t('sending') : t('send')}
          </button>
        </>
      ) : (
        <>
          <input type="hidden" name="email" value={state.email} />
          <div className={styles.notice} role="status">
            <p className={styles.sent}>{t('sent')}</p>
            <p className={styles.hint}>{t('sentHint')}</p>
          </div>
          <div className={styles.field}>
            <label htmlFor={codeId} className={styles.label}>
              {t('codeLabel')}
            </label>
            <input
              key={state.email}
              id={codeId}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={CODE_LENGTH + 1}
              required
              autoFocus
              className={`${styles.input} ${styles.code}`}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              disabled={isPending}
            />
          </div>
          <button
            type="submit"
            name="intent"
            value="verify"
            className={styles.button}
            disabled={isPending}
          >
            {isPending ? t('verifying') : t('verify')}
          </button>
          <div className={styles.secondary}>
            <button
              type="submit"
              name="intent"
              value="request"
              formNoValidate
              className={styles.link}
              disabled={isPending}
            >
              {t('resend')}
            </button>
            <button
              type="submit"
              name="intent"
              value="restart"
              formNoValidate
              className={styles.link}
              disabled={isPending}
            >
              {t('restart')}
            </button>
          </div>
        </>
      )}

      <p id={errorId} className={styles.error} role="alert">
        {error ? t(`errors.${error}`) : null}
      </p>
    </form>
  )
}
