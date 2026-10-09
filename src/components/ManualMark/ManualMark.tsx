'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useId, useState, type FormEvent } from 'react'

import { markSlotAction } from '@/features/slot-timer/actions'
import type { TimerActionState, TimerError } from '@/features/slot-timer/schema'
import { MAX_SLOT_MINUTES, type TimerState } from '@/features/slot-timer/shape'

import styles from './ManualMark.module.css'

type Props = {
  programDay: number
  slotIndex: number
  slotName: string
  /** Minutes saved now: the field starts with them. */
  minutes: number
  /** The server's answer, for a parent that shows today's slots itself. */
  onSaved?: (state: TimerState) => void
}

/**
 * «Отметить вручную» on one slot of today or a past day (story 015). The browser names the day,
 * the slot and the minutes; the server decides the rest. Saving again updates the same record, 0
 * resets the slot.
 */
export function ManualMark({ programDay, slotIndex, slotName, minutes, onSaved }: Props) {
  const t = useTranslations('StudyTimer')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(minutes > 0 ? String(minutes) : '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<TimerError | 'not_a_number' | null>(null)
  const fieldId = useId()
  const errorId = useId()

  const toggle = () => {
    setError(null)
    if (!open) setValue(minutes > 0 ? String(minutes) : '')
    setOpen(!open)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    const text = value.trim()
    if (!/^\d+$/.test(text)) return setError('not_a_number')
    const parsed = Number(text)
    if (parsed > MAX_SLOT_MINUTES) return setError('too_many_minutes')
    setPending(true)
    setError(null)
    let answer: TimerActionState
    try {
      answer = await markSlotAction({ programDay, slotIndex, minutes: parsed })
    } catch {
      answer = { status: 'error', error: 'server' }
    }
    setPending(false)
    if (answer.status === 'error') return setError(answer.error)
    setOpen(false)
    onSaved?.(answer.state)
    router.refresh()
  }

  return (
    <div className={styles.mark}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-label={t('manualOf', { name: slotName })}
        onClick={toggle}
      >
        {t('manual')}
      </button>
      {open ? (
        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
          <label htmlFor={fieldId} className={styles.label}>
            {t('manualMinutes', { name: slotName })}
          </label>
          <input
            id={fieldId}
            className={styles.input}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={error != null}
            aria-describedby={errorId}
          />
          <p className={styles.hint}>{t('manualHint')}</p>
          <div className={styles.actions}>
            <button type="submit" className={styles.save} disabled={pending}>
              {pending ? t('working') : t('save')}
            </button>
            <button type="button" className={styles.cancel} onClick={toggle} disabled={pending}>
              {t('cancel')}
            </button>
          </div>
          <p id={errorId} className={styles.error} role="alert">
            {error ? t(`errors.${error}`) : null}
          </p>
        </form>
      ) : null}
    </div>
  )
}
