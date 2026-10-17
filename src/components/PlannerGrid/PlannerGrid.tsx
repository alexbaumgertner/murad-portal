'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

import {
  addRowAction,
  removeRowAction,
  setCellTextAction,
  setOwnTaskAction,
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
  /** The owner's task types: a student picks one of them for a cell. */
  taskTypes?: string[]
  /** The owner edits task text; a student only ticks. Both add and remove priority rows. */
  canEdit: boolean
  /** Seven weekday names (defaults or the owner's overrides). */
  dayNames: string[]
  /** Owner renames a weekday; resolves the error code when saving failed, else null. */
  onDayName?: (day: number, value: string) => Promise<PlannerError | null>
  /** Called with the live cells after every change, so siblings can show progress. */
  onCellsChange?: (cells: Record<string, CellView>) => void
}

type Entry = {
  /** What the cell shows while the entry is kept. */
  cell: CellView
  /** The server cell the edit started from; once the server moves on, the snapshot wins again. */
  base: CellView | undefined
  /** The last value we know the server accepted (or the start value). */
  saved: CellView
}

/** Shared attributes of the small line icons (story 034: repeated words in cells become icons). */
const ICON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

const EMPTY: CellView = { text: '', done: false }
const same = (a: CellView | undefined, b: CellView | undefined) =>
  (a?.text ?? '') === (b?.text ?? '') && Boolean(a?.done) === Boolean(b?.done)

/**
 * The weekly grid (story 022): priority rows × Monday…Sunday. Typing and ticking are separate
 * controls, so editing text never toggles a task. The server snapshot (`cells`) is the truth; a
 * local overlay holds only the cell in focus, cells being saved, and our own saves the server
 * has not reflected yet. A failed save puts the previous value back and says why.
 */
export function PlannerGrid({
  weekId,
  rowCount,
  dates,
  cells: server,
  taskTypes = [],
  canEdit,
  dayNames,
  onDayName,
  onCellsChange,
}: Props) {
  const t = useTranslations('Planner')
  const locale = useLocale()
  const router = useRouter()
  const [overlay, setOverlay] = useState<Record<string, Entry>>({})
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [inflight, setInflight] = useState<string[]>([])
  const [error, setError] = useState<PlannerError | null>(null)
  /** Cells where a student has pressed «+ own» and is typing (story 034). */
  const [ownOpen, setOwnOpen] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  /** Bumped on every change to a cell, so a failed save can tell whether it is still the latest word. */
  const touched = useRef<Record<string, number>>({})

  const cells = useMemo(() => {
    const merged = { ...server }
    for (const [key, entry] of Object.entries(overlay))
      if (key === focusKey || inflight.includes(key) || same(server[key], entry.base))
        merged[key] = entry.cell
    return merged
  }, [server, overlay, focusKey, inflight])

  useEffect(() => onCellsChange?.(cells), [cells, onCellsChange])

  // Drop entries the snapshot has overtaken, and everything on rows that no longer exist.
  // Adjusting state while rendering (guarded) re-renders at once, before anything is painted.
  const gone = (key: string) => Number(key.split('-')[0]) >= rowCount
  if (focusKey && gone(focusKey)) setFocusKey(null)
  const kept = Object.entries(overlay).filter(
    ([key, entry]) =>
      !gone(key) && (key === focusKey || inflight.includes(key) || same(server[key], entry.base)),
  )
  if (kept.length !== Object.keys(overlay).length) setOverlay(Object.fromEntries(kept))

  /** Starts or updates the overlay entry for a cell, remembering where the edit began. */
  const put = (key: string, cell: CellView, saved?: CellView) => {
    touched.current[key] = (touched.current[key] ?? 0) + 1
    setOverlay((all) => ({
      ...all,
      [key]: {
        cell,
        // A save re-bases the entry: our value stays until the server moves on from what it shows now.
        base: saved || !all[key] ? server[key] : all[key].base,
        saved: saved ?? all[key]?.saved ?? server[key] ?? EMPTY,
      },
    }))
  }

  /** Puts `before` back after a failed save, unless the cell was edited again meanwhile. */
  const rollBack = (key: string, before: CellView, stamp: number) => {
    if (touched.current[key] === stamp) put(key, before, before)
    else setOverlay((all) => (all[key] ? { ...all, [key]: { ...all[key], saved: before } } : all))
  }

  async function persist<T extends { status: string }>(key: string, send: () => Promise<T>) {
    setInflight((all) => [...all, key])
    try {
      return await send()
    } finally {
      setInflight((all) => all.filter((k) => k !== key))
    }
  }

  const dateLabel = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(`${iso}T12:00:00Z`),
    )

  async function saveText(row: number, day: number, text: string) {
    const key = `${row}-${day}`
    const before = overlay[key]?.saved ?? server[key]
    if ((before?.text ?? '') === text) return
    const next: CellView = { text, done: isAssignedTask(text) ? Boolean(before?.done) : false }
    put(key, next, next)
    const stamp = touched.current[key]!
    const result = await persist(key, () => setCellTextAction({ weekId, row, day, text }))
    if (result.status === 'error') {
      setError(result.error)
      rollBack(key, before ?? EMPTY, stamp)
    } else setError(null)
  }

  /** A student's own task (story 034); an emptied one is cleared like any other text. */
  async function saveOwn(row: number, day: number, raw: string) {
    const key = `${row}-${day}`
    const text = raw.trim()
    setOwnOpen((all) => all.filter((k) => k !== key))
    if (!isAssignedTask(text)) return saveText(row, day, '')
    const before = overlay[key]?.saved ?? server[key]
    if ((before?.text ?? '') === text && before?.own) return
    const next = { text, done: Boolean(before?.done), own: true }
    put(key, next, next)
    const stamp = touched.current[key]!
    const result = await persist(key, () => setOwnTaskAction({ weekId, row, day, text }))
    if (result.status === 'error') {
      setError(result.error)
      rollBack(key, before ?? EMPTY, stamp)
    } else setError(null)
  }

  async function tick(row: number, day: number) {
    const key = `${row}-${day}`
    const before = cells[key]
    if (!before || !isAssignedTask(before.text)) return
    const next = { ...before, done: !before.done }
    put(key, next, next)
    const stamp = touched.current[key]!
    const result = await persist(key, () => setDoneAction({ weekId, row, day, done: next.done }))
    if (result.status === 'error') {
      setError(result.error)
      rollBack(key, before, stamp)
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
            <span
              role="columnheader"
              className={styles.corner}
              aria-label={t('slot')}
              title={`${t('slot')}: ${t('slotHint')}`}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 6h11M10 12h11M10 18h11" />
                <path d="M3 6l1.5-1v4M3 12.5h3L3 16h3.2M3 19h3v2H3" />
              </svg>
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
                    onSave={async (value) => {
                      const code = await onDayName!(day, value)
                      setError(code)
                      return code === null
                    }}
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
                        value={cell?.text ?? ''}
                        maxLength={MAX_TASK_TEXT}
                        rows={2}
                        onFocus={() => {
                          setFocusKey(`${row}-${day}`)
                          put(`${row}-${day}`, cell ?? EMPTY)
                        }}
                        onChange={(event) =>
                          put(`${row}-${day}`, { ...(cell ?? EMPTY), text: event.target.value })
                        }
                        onBlur={(event) => {
                          setFocusKey((current) => (current === `${row}-${day}` ? null : current))
                          void saveText(row, day, event.currentTarget.value)
                        }}
                      />
                    ) : cell?.own || ownOpen.includes(`${row}-${day}`) ? (
                      <textarea
                        className={styles.text}
                        aria-label={label}
                        value={cell?.text ?? ''}
                        maxLength={MAX_TASK_TEXT}
                        rows={2}
                        autoFocus={!cell?.own}
                        onFocus={() => {
                          setFocusKey(`${row}-${day}`)
                          put(`${row}-${day}`, cell ?? EMPTY)
                        }}
                        onChange={(event) =>
                          put(`${row}-${day}`, {
                            ...(cell ?? EMPTY),
                            text: event.target.value,
                            own: true,
                          })
                        }
                        onBlur={(event) => {
                          setFocusKey((current) => (current === `${row}-${day}` ? null : current))
                          void saveOwn(row, day, event.currentTarget.value)
                        }}
                      />
                    ) : taskTypes.length > 0 ? (
                      <select
                        className={cell?.text ? styles.pick : styles.pickEmpty}
                        aria-label={label}
                        value={cell?.text ?? ''}
                        disabled={pending}
                        onChange={(event) => void saveText(row, day, event.target.value)}
                      >
                        <option value="" label=" " />
                        {cell?.text && !taskTypes.includes(cell.text) ? (
                          <option value={cell.text}>{cell.text}</option>
                        ) : null}
                        {taskTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={styles.readText}>{cell?.text}</span>
                    )}
                    {!canEdit && !assigned && !ownOpen.includes(`${row}-${day}`) ? (
                      <button
                        type="button"
                        className={styles.addOwn}
                        aria-label={t('addOwnLabel', { cell: label })}
                        onClick={() => setOwnOpen((all) => [...all, `${row}-${day}`])}
                      >
                        <svg {...ICON} width="14" height="14">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                        </svg>
                      </button>
                    ) : null}
                    {cell?.own && assigned ? (
                      <svg
                        {...ICON}
                        width="12"
                        height="12"
                        className={styles.ownMark}
                        role="img"
                        aria-hidden={false}
                        aria-label={t('own')}
                      >
                        <title>{t('own')}</title>
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                      </svg>
                    ) : null}
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
      {!canEdit && taskTypes.length === 0 ? (
        <p className={styles.hint}>{t('noTaskTypes')}</p>
      ) : null}
      <p role="status" className={styles.error}>
        {error ? t(`errors.${error}`) : ''}
      </p>
    </section>
  )
}
