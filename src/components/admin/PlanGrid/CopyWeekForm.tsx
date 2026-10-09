'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useId } from 'react'

import { copyWeekAction } from '@/features/program-plan/actions'
import { initialCopyWeekState, type CopyWeekError } from '@/features/program-plan/schema'
import { copySummary } from '@/features/program-plan/shape'

import styles from './PlanGrid.module.css'

const errorMessages: Record<CopyWeekError, string> = {
  forbidden: 'Копировать план может только владелец.',
  invalid_input: 'Введи номера недель числами.',
  invalid_range: 'Недели должны быть в пределах программы, а исходная — вне диапазона копирования.',
  not_found: 'Программа не найдена.',
  server: 'Не получилось скопировать. Попробуй ещё раз.',
}

/** Copies one week of the default plan into a range of later weeks, never overwriting. */
export function CopyWeekForm({
  programId,
  durationWeeks,
}: {
  programId: number
  durationWeeks: number
}) {
  const [state, formAction, isPending] = useActionState(copyWeekAction, initialCopyWeekState)
  const router = useRouter()
  const fromId = useId()
  const firstId = useId()
  const lastId = useId()

  useEffect(() => {
    // Show the new items in the grid above.
    if (state.status === 'success') router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className={styles.copy}>
      <input type="hidden" name="programId" value={programId} />
      <div className={styles.field}>
        <label htmlFor={fromId}>Копировать неделю</label>
        <input
          id={fromId}
          name="fromWeek"
          type="number"
          min={1}
          max={durationWeeks}
          defaultValue={1}
          required
          disabled={isPending}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor={firstId}>в недели с</label>
        <input
          id={firstId}
          name="toFirst"
          type="number"
          min={1}
          max={durationWeeks}
          defaultValue={2}
          required
          disabled={isPending}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor={lastId}>по</label>
        <input
          id={lastId}
          name="toLast"
          type="number"
          min={1}
          max={durationWeeks}
          defaultValue={4}
          required
          disabled={isPending}
        />
      </div>
      <button
        type="submit"
        className="btn btn--style-primary btn--size-medium"
        disabled={isPending}
      >
        {isPending ? 'Копирую…' : 'Копировать'}
      </button>
      <p
        className={state.status === 'error' ? styles.error : styles.success}
        role={state.status === 'error' ? 'alert' : 'status'}
      >
        {state.status === 'error' ? errorMessages[state.error] : null}
        {state.status === 'success' ? copySummary(state.copied, state.skipped) : null}
      </p>
    </form>
  )
}
