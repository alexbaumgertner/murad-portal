'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { saveProgressSettingsAction } from '@/features/planner/actions'
import type { ProgressSettings } from '@/features/planner/queries'
import type { PlannerError } from '@/features/planner/schema'
import { MAX_DEADLINE_TITLE } from '@/features/planner/shape'
import { useRouter } from '@/i18n/navigation'

import styles from './PlannerProgressSettings.module.css'

/** Owner-only: which progress blocks show, and the exam deadline. Hidden until opened. */
export function PlannerProgressSettings({
  plannerId,
  initial,
}: {
  plannerId: number
  initial: ProgressSettings
}) {
  const t = useTranslations('Planner.progress')
  const errors = useTranslations('Planner.errors')
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [error, setError] = useState<PlannerError | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const toggle = (key: 'showWeekProgress' | 'showFourWeekProgress' | 'showDeadlineProgress') => (
    <input
      type="checkbox"
      checked={values[key]}
      onChange={(event) => {
        setSaved(false)
        setValues({ ...values, [key]: event.target.checked })
      }}
    />
  )

  function save() {
    startTransition(async () => {
      const result = await saveProgressSettingsAction({ plannerId, ...values })
      setError(result.status === 'error' ? result.error : null)
      setSaved(result.status === 'success')
      if (result.status === 'success') router.refresh()
    })
  }

  return (
    <details className={styles.details}>
      <summary className={styles.summary}>{t('settings')}</summary>
      <div className={styles.body}>
        <label className={styles.check}>
          {toggle('showWeekProgress')} {t('showWeek')}
        </label>
        <label className={styles.check}>
          {toggle('showFourWeekProgress')} {t('showFourWeeks')}
        </label>
        <label className={styles.check}>
          {toggle('showDeadlineProgress')} {t('showDeadline')}
        </label>
        <label className={styles.field}>
          {t('deadlineTitle')}
          <input
            type="text"
            maxLength={MAX_DEADLINE_TITLE}
            value={values.deadlineTitle}
            onChange={(event) => setValues({ ...values, deadlineTitle: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          {t('deadlineDate')}
          <input
            type="date"
            value={values.deadlineDate}
            onChange={(event) => setValues({ ...values, deadlineDate: event.target.value })}
          />
        </label>
        <button type="button" className={styles.save} disabled={pending} onClick={save}>
          {t('save')}
        </button>
        <p role="status" className={error ? styles.error : styles.ok}>
          {error ? errors(error) : saved ? t('saved') : ''}
        </p>
      </div>
    </details>
  )
}
