'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { addWeekAction, createPlannerAction, deleteWeekAction } from '@/features/planner/actions'
import type { PlannerError } from '@/features/planner/schema'
import { useRouter } from '@/i18n/navigation'

import styles from './PlannerWeekBar.module.css'

type Props =
  | { kind: 'create'; studentId: number; today: string }
  | { kind: 'owner'; plannerId: number; weekId: number; lastWeek: boolean }

/** Owner-only controls: create a planner, add a week, delete this week (with a warning). */
export function PlannerWeekBar(props: Props) {
  const t = useTranslations('Planner')
  const router = useRouter()
  const [error, setError] = useState<PlannerError | null>(null)
  const [pending, startTransition] = useTransition()

  function run(work: () => ReturnType<typeof addWeekAction>) {
    startTransition(async () => {
      const result = await work()
      if (result.status === 'error') setError(result.error)
      else {
        setError(null)
        router.refresh()
      }
    })
  }

  return (
    <div className={styles.bar}>
      {props.kind === 'create' ? (
        <button
          type="button"
          className={styles.button}
          disabled={pending}
          onClick={() =>
            run(() => createPlannerAction({ studentId: props.studentId, baseDate: props.today }))
          }
        >
          {t('create')}
        </button>
      ) : (
        <>
          <button
            type="button"
            className={styles.button}
            disabled={pending}
            onClick={() => run(() => addWeekAction({ plannerId: props.plannerId }))}
          >
            + {t('addWeek')}
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={pending || props.lastWeek}
            onClick={() => {
              if (window.confirm(t('deleteWeekConfirm')))
                run(() => deleteWeekAction({ weekId: props.weekId }))
            }}
          >
            {t('deleteWeek')}
          </button>
        </>
      )}
      <p role="status" className={styles.error}>
        {error ? t(`errors.${error}`) : ''}
      </p>
    </div>
  )
}
