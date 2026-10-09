'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'

import { pauseProgramAction, resumeProgramAction } from '@/features/program-pause/actions'
import type { PauseError } from '@/features/program-pause/schema'

import styles from './PauseProgram.module.css'

/**
 * «Пауза» (with a confirmation) while the program runs, «Продолжить» while it is paused (story
 * 017). The browser sends nothing — the server pauses the signed-in student's own program from
 * today. Controls are disabled while the request runs; an error stays visible next to them.
 */
export function PauseProgram({ paused }: { paused: boolean }) {
  const t = useTranslations('StudyPause')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<PauseError | null>(null)
  const confirmId = useId()

  function run(action: typeof pauseProgramAction) {
    setError(null)
    startTransition(async () => {
      const result = await action({})
      if (result.status === 'error') {
        setError(result.error)
        return
      }
      setConfirming(false)
      router.refresh() // the page re-renders as paused (or as «Сегодня» again)
    })
  }

  return (
    <div className={styles.pause}>
      {paused ? (
        <button
          type="button"
          className={styles.primary}
          onClick={() => run(resumeProgramAction)}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? t('resumePending') : t('resume')}
        </button>
      ) : confirming ? (
        <div role="group" aria-labelledby={confirmId} className={styles.confirm}>
          <p id={confirmId} className={styles.question}>
            {t('confirm')}
          </p>
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => run(pauseProgramAction)}
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? t('pending') : t('confirmYes')}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.secondary} onClick={() => setConfirming(true)}>
          {t('pause')}
        </button>
      )}

      <p className={styles.error} role="alert">
        {error ? t(`errors.${error}`) : null}
      </p>
    </div>
  )
}
