'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { saveTaskTypesAction } from '@/features/planner/actions'
import type { PlannerError } from '@/features/planner/schema'
import { MAX_TASK_TYPE, MAX_TASK_TYPES } from '@/features/planner/shape'
import { useRouter } from '@/i18n/navigation'

import styles from '../PlannerProgressSettings/PlannerProgressSettings.module.css'

/** Owner-only: the task types a student picks from in her cells, one per line. */
export function PlannerTaskTypes({ plannerId, initial }: { plannerId: number; initial: string[] }) {
  const t = useTranslations('Planner.taskTypes')
  const errors = useTranslations('Planner.errors')
  const router = useRouter()
  const [text, setText] = useState(initial.join('\n'))
  const [error, setError] = useState<PlannerError | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const types = text.split('\n').map((line) => line.trim())
      const result = await saveTaskTypesAction({ plannerId, types: types.filter(Boolean) })
      setError(result.status === 'error' ? result.error : null)
      setSaved(result.status === 'success')
      if (result.status === 'success') router.refresh()
    })
  }

  return (
    <details className={styles.details}>
      <summary className={styles.summary}>{t('summary')}</summary>
      <div className={styles.body}>
        <label className={styles.field}>
          {t('label', { max: MAX_TASK_TYPES })}
          <textarea
            rows={6}
            value={text}
            maxLength={MAX_TASK_TYPE * MAX_TASK_TYPES + MAX_TASK_TYPES}
            onChange={(event) => {
              setSaved(false)
              setText(event.target.value)
            }}
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
