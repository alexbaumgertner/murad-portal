'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useId, useState, type ReactNode } from 'react'

import { closeDayAction } from '@/features/challenge/actions'
import { initialCloseDayState, type CloseDayState } from '@/features/challenge/schema'

import styles from './CloseDayCell.module.css'

type Props = {
  slug: string
  dayNumber: number
  /** Challenge `dailyMinutes`: the default for a day that is not closed yet. */
  defaultMinutes: number
  /** Saved values of an already closed day. */
  minutes?: number
  notes?: string
  label: string
  /** Contents of the cell (number and state symbol). */
  summary: ReactNode
  summaryClassName?: string
  /** Read-only details of a closed day, shown above the form. */
  children?: ReactNode
}

export function CloseDayCell({
  slug,
  dayNumber,
  defaultMinutes,
  minutes,
  notes,
  label,
  summary,
  summaryClassName,
  children,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className={summaryClassName} aria-label={label}>
        {summary}
      </summary>
      <div className={styles.panel}>
        {children}
        {/* Keyed by the saved values so a reopened form shows what the server now holds. */}
        <DayForm
          key={`${minutes ?? ''}|${notes ?? ''}`}
          slug={slug}
          dayNumber={dayNumber}
          closed={minutes !== undefined}
          initialMinutes={minutes ?? defaultMinutes}
          initialNotes={notes ?? ''}
          onSaved={() => setOpen(false)}
        />
      </div>
    </details>
  )
}

type FormProps = {
  slug: string
  dayNumber: number
  closed: boolean
  initialMinutes: number
  initialNotes: string
  onSaved: () => void
}

function DayForm({ slug, dayNumber, closed, initialMinutes, initialNotes, onSaved }: FormProps) {
  const t = useTranslations('Challenge.closeDay')
  // Controlled on purpose: React resets uncontrolled fields after every form action, which would
  // wipe the notes the moment the server answers with an error.
  const [minutes, setMinutes] = useState(String(initialMinutes))
  const [notes, setNotes] = useState(initialNotes)
  const [state, formAction, isPending] = useActionState(
    async (prev: CloseDayState, formData: FormData) => {
      const next = await closeDayAction(prev, formData)
      if (next.status === 'success') onSaved()
      return next
    },
    initialCloseDayState,
  )
  const minutesId = useId()
  const notesId = useId()
  const errorId = useId()
  const error = state.status === 'error' ? state.error : null

  return (
    <form action={formAction} className={styles.form} noValidate>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="dayNumber" value={dayNumber} />
      <label htmlFor={minutesId}>{t('minutesLabel')}</label>
      <input
        id={minutesId}
        name="minutes"
        type="number"
        inputMode="numeric"
        value={minutes}
        onChange={(event) => setMinutes(event.target.value)}
        className={styles.input}
        aria-invalid={error === 'invalid_minutes'}
        aria-describedby={error ? errorId : undefined}
        readOnly={isPending}
      />
      <label htmlFor={notesId}>{t('notesLabel')}</label>
      <textarea
        id={notesId}
        name="notes"
        rows={3}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        className={styles.input}
        aria-invalid={error === 'invalid_notes'}
        aria-describedby={error ? errorId : undefined}
        readOnly={isPending}
      />
      <button type="submit" className={styles.button} disabled={isPending}>
        {isPending ? t('pending') : closed ? t('update') : t('submit')}
      </button>
      <p id={errorId} className={styles.error} role="alert">
        {error ? t(`errors.${error}`) : null}
      </p>
    </form>
  )
}
