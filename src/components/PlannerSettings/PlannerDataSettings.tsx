'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import {
  exportPlannerAction,
  importPlannerAction,
  resetPlannerAction,
} from '@/features/planner/actions'
import type { PlannerError } from '@/features/planner/schema'

import styles from './PlannerSettings.module.css'

/** Backup file out and in, and a full reset. The student can only export her own planner. */
export function PlannerDataSettings({
  plannerId,
  isOwner,
}: {
  plannerId: number
  isOwner: boolean
}) {
  const t = useTranslations('Planner.settings.data')
  const errors = useTranslations('Planner.errors')
  const [error, setError] = useState<PlannerError | null>(null)
  const [done, setDone] = useState<'exported' | null>(null)
  const [pending, startTransition] = useTransition()

  function download() {
    startTransition(async () => {
      const result = await exportPlannerAction({ plannerId })
      if (result.status === 'error') return setError(result.error)
      const url = URL.createObjectURL(new Blob([result.json], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = result.filename
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      setError(null)
      setDone('exported')
    })
  }

  function upload(file: File | undefined) {
    if (!file) return
    startTransition(async () => {
      const json = await file.text()
      if (!window.confirm(t('importConfirm'))) return
      const result = await importPlannerAction({ plannerId, json })
      if (result.status === 'error') return setError(result.error)
      window.location.reload()
    })
  }

  function reset() {
    if (!window.confirm(t('resetConfirm'))) return
    startTransition(async () => {
      const result = await resetPlannerAction({ plannerId })
      if (result.status === 'error') return setError(result.error)
      window.location.reload()
    })
  }

  return (
    <div className={styles.group}>
      <button type="button" className={styles.button} disabled={pending} onClick={download}>
        {t('export')}
      </button>
      {isOwner ? (
        <>
          <label className={styles.colorLabel}>
            {t('import')}
            <input
              type="file"
              accept="application/json,.json"
              aria-label={t('import')}
              disabled={pending}
              onChange={(event) => {
                upload(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </label>
          <button type="button" className={styles.button} disabled={pending} onClick={reset}>
            {t('reset')}
          </button>
        </>
      ) : null}
      <p role="status" className={error ? styles.warning : undefined}>
        {error ? errors(error) : done ? t('exported') : ''}
      </p>
    </div>
  )
}
