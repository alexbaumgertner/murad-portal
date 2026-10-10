import { createTranslator } from 'next-intl'

import { DayMarker } from '@/components/DayMarker/DayMarker'
import {
  DAY_STATES,
  DAY_MARKERS,
  formatCalendarDate,
  type GridCell,
} from '@/features/study-today/shape'
import { messagesFor, type AddressForm } from '@/i18n/address-form'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

import styles from './DayGrid.module.css'

type Props = {
  cells: GridCell[]
  week: number
  /** Program day whose detail is open below the grid (today unless another day was picked). */
  selected: number
  locale: Locale
  addressForm: AddressForm
  /** The owner's view (story 019): the same cells, but no link, nothing to open or mark. */
  readOnly?: boolean
}

/** A pause longer than this many days is one wide cell instead of a wall of ‖ (story 017, Q6: no limit). */
const LONG_PAUSE = 7

type Item = { kind: 'day'; cell: GridCell } | { kind: 'pause'; cells: GridCell[] }

function group(cells: GridCell[]): Item[] {
  const items: Item[] = []
  for (const cell of cells) {
    const last = items[items.length - 1]
    if (cell.programDay == null && last?.kind === 'pause') last.cells.push(cell)
    else if (cell.programDay == null) items.push({ kind: 'pause', cells: [cell] })
    else items.push({ kind: 'day', cell })
  }
  return items.flatMap((item) =>
    item.kind === 'pause' && item.cells.length <= LONG_PAUSE
      ? item.cells.map((cell): Item => ({ kind: 'pause', cells: [cell] }))
      : [item],
  )
}

/**
 * The calendar days of the current program week (story 013): weekday, date, state marker. Paused
 * calendar days (story 017) show ‖ and are not links: they have no program day to open, mark or
 * comment on.
 */
export function DayGrid({ cells, week, selected, locale, addressForm, readOnly = false }: Props) {
  const t = createTranslator({
    locale,
    messages: messagesFor(locale, addressForm),
    namespace: 'StudyToday',
  })

  return (
    <div className={styles.wrap}>
      <ol className={styles.grid} aria-label={t('gridLabel', { week })}>
        {group(cells).map((item) => {
          if (item.kind === 'pause') {
            const first = item.cells[0]!
            const last = item.cells[item.cells.length - 1]!
            const from = formatCalendarDate(first.date, locale)
            if (item.cells.length === 1) {
              return (
                <li key={first.date} className={styles.item}>
                  <div
                    className={styles.cell}
                    data-state="paused"
                    role="img"
                    aria-label={t('pausedCellLabel', {
                      date: from.long,
                      state: t('states.paused'),
                    })}
                  >
                    <span className={styles.weekday} aria-hidden="true">
                      {from.weekday}
                    </span>
                    <span className={styles.date} aria-hidden="true">
                      {from.dayOfMonth}
                    </span>
                    <span className={styles.mark} aria-hidden="true">
                      {DAY_MARKERS.paused}
                    </span>
                  </div>
                </li>
              )
            }
            const run = t('pausedRun', {
              from: from.long,
              to: formatCalendarDate(last.date, locale).long,
              count: item.cells.length,
            })
            return (
              <li key={first.date} className={`${styles.item} ${styles.run}`}>
                <div className={styles.cell} data-state="paused" role="img" aria-label={run}>
                  <span className={styles.mark} aria-hidden="true">
                    {DAY_MARKERS.paused}
                  </span>
                  <span className={styles.runText} aria-hidden="true">
                    {run}
                  </span>
                </div>
              </li>
            )
          }
          const { cell } = item
          const programDay = cell.programDay!
          const date = formatCalendarDate(cell.date, locale)
          const isToday = cell.state === 'today'
          const label = t('cellLabel', {
            day: programDay,
            date: date.long,
            state: t(`states.${cell.state}`),
          })
          const content = (
            <>
              <span className={styles.weekday} aria-hidden="true">
                {date.weekday}
              </span>
              <span className={styles.date} aria-hidden="true">
                {date.dayOfMonth}
              </span>
              <span className={styles.mark} aria-hidden="true">
                {DAY_MARKERS[cell.state] || ' '}
              </span>
            </>
          )
          return (
            <li key={cell.date} className={styles.item}>
              {readOnly ? (
                <div className={styles.cell} data-state={cell.state} role="img" aria-label={label}>
                  {content}
                </div>
              ) : (
                <Link
                  href={isToday ? '/study' : { pathname: '/study', query: { day: programDay } }}
                  className={styles.cell}
                  data-state={cell.state}
                  aria-current={programDay === selected ? 'date' : undefined}
                  aria-label={label}
                >
                  {content}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
      <ul className={styles.legend} aria-label={t('legend')}>
        {DAY_STATES.filter((state) => state !== 'upcoming').map((state) => (
          <li key={state} className={styles.legendItem}>
            <DayMarker state={state} locale={locale} addressForm={addressForm} />
            <span aria-hidden="true">{t(`states.${state}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
