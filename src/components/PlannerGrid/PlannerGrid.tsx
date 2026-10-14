'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'

import {
  addRowAction,
  removeRowAction,
  setCellTextAction,
  setDoneAction,
} from '@/features/planner/actions'
import type { CellView } from '@/features/planner/queries'
import type { PlannerError } from '@/features/planner/schema'
import { MAX_LABEL, MAX_TASK_TEXT, isAssignedTask, roman } from '@/features/planner/shape'
import { EditableText } from '@/components/EditableText/EditableText'
import { useRouter } from '@/i18n/navigation'

import styles from './PlannerGrid.module.css'

type Props = {
  weekId: number
  rowCount: number
  /** Seven `YYYY-MM-DD` dates, Monday first. */
  dates: string[]
  cells: Record<string, CellView>
  /** The owner edits task text; a student only ticks. Both add and remove priority rows. */
  canEdit: boolean
  /** Seven weekday names (defaults or the owner's overrides). */
  dayNames: string[]
  /** Owner renames a weekday; resolves false when saving failed. */
  onDayName?: (day: number, value: string) => Promise<boolean>
  /** Called with the live cells after every change, so siblings can show progress. */
  onCellsChange?: (cells: Record<string, CellView>) => void
}

/**
 * The weekly grid (story 022): priority rows × Monday…Sunday. Typing and ticking are separate
 * controls, so editing text never toggles a task. State is local and optimistic; a failed save
 * puts the previous value back and says why.
 */
export function PlannerGrid({
  weekId,
  rowCount,
  dates,
  cells: initial,
  canEdit,
  dayNames,
  onDayName,
  onCellsChange,
}: Props) {
  const t = useTranslations('Planner')
  const locale = useLocale()
  const router = useRouter()
  const [cells, setCells] = useState(initial)
  const [error, setError] = useState<PlannerError | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => onCellsChange?.(cells), [cells, onCellsChange])

  const dateLabel = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(`${iso}T12:00:00Z`),
    )

  async function saveText(row: number, day: number, text: string) {
    const key = `${row}-${day}`
    const before = cells[key]
    if ((before?.text ?? '') === text) return
    setCells((all) => ({
      ...all,
      [key]: { text, done: isAssignedTask(text) ? Boolean(before?.done) : false },
    }))
    const result = await setCellTextAction({ weekId, row, day, text })
    if (result.status === 'error') {
      setError(result.error)
      setCells((all) => ({ ...all, [key]: before ?? { text: '', done: false } }))
    } else setError(null)
  }

  async function tick(row: number, day: number) {
    const key = `${row}-${day}`
    const before = cells[key]
    if (!before || !isAssignedTask(before.text)) return
    const done = !before.done
    setCells((all) => ({ ...all, [key]: { ...before, done } }))
    const result = await setDoneAction({ weekId, row, day, done })
    if (result.status === 'error') {
      setError(result.error)
      setCells((all) => ({ ...all, [key]: before }))
    } else setError(null)
  }

  function changeRows(kind: 'add' | 'remove') {
    if (kind === 'remove' && !window.confirm(t('removeConfirm'))) return
    startTransition(async () => {
      const result = await (kind === 'add' ? addRowAction : removeRowAction)({ weekId })
      if (result.status === 'error') setError(result.error)
      else {
        setError(null)
        router.refresh()
      }
    })
  }

  return (
    <section className={styles.wrap} aria-label={t('gridLabel')}>
      <div className={styles.scroll}>
        <div className={styles.grid} role="table" aria-label={t('gridLabel')}>
          <div role="row" className={styles.row}>
            <span role="columnheader" className={styles.corner} title={t('slotHint')}>
              {t('slot')}
            </span>
            {dates.map((iso, day) => (
              <span key={iso} role="columnheader" className={styles.head}>
                <span className={styles.date}>{dateLabel(iso)}</span>
                <span className={styles.day}>
                  <EditableText
                    value={dayNames[day]!}
                    label={t('dayNameLabel', { n: day + 1 })}
                    canEdit={canEdit && Boolean(onDayName)}
                    maxLength={MAX_LABEL}
                    onSave={(value) => onDayName!(day, value)}
                  />
                </span>
              </span>
            ))}
          </div>
          {Array.from({ length: rowCount }, (_, row) => (
            <div key={row} role="row" className={styles.row}>
              <span role="rowheader" className={styles.priority}>
                {roman(row + 1)}
              </span>
              {dates.map((iso, day) => {
                const cell = cells[`${row}-${day}`]
                const assigned = isAssignedTask(cell?.text)
                const label = t('cellLabel', { row: roman(row + 1), date: dateLabel(iso) })
                return (
                  <div
                    key={iso}
                    role="cell"
                    className={cell?.done && assigned ? styles.cellDone : styles.cell}
                  >
                    {canEdit ? (
                      <textarea
                        className={styles.text}
                        aria-label={label}
                        defaultValue={cell?.text ?? ''}
                        maxLength={MAX_TASK_TEXT}
                        rows={2}
                        onBlur={(event) => void saveText(row, day, event.currentTarget.value)}
                      />
                    ) : (
                      <span className={styles.readText}>{cell?.text}</span>
                    )}
                    {assigned ? (
                      <button
                        type="button"
                        className={styles.tick}
                        aria-pressed={Boolean(cell?.done)}
                        aria-label={t('tickLabel', { task: cell?.text ?? '' })}
                        onClick={() => void tick(row, day)}
                      >
                        <span aria-hidden="true">✓</span>
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.control}
          disabled={pending}
          onClick={() => changeRows('add')}
        >
          + {t('addPriority')}
        </button>
        <button
          type="button"
          className={styles.control}
          disabled={pending || rowCount <= 1}
          onClick={() => changeRows('remove')}
        >
          − {t('removePriority')}
        </button>
      </div>
      <p role="status" className={styles.error}>
        {error ? t(`errors.${error}`) : ''}
      </p>
    </section>
  )
}
