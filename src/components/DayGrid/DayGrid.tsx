import { createTranslator } from 'next-intl'

import { DayMarker } from '@/components/DayMarker/DayMarker'
import {
  DAY_STATES,
  DAY_MARKERS,
  formatCalendarDate,
  type WeekCell,
} from '@/features/study-today/shape'
import { messagesFor, type AddressForm } from '@/i18n/address-form'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

import styles from './DayGrid.module.css'

type Props = {
  cells: WeekCell[]
  week: number
  /** Program day whose detail is open below the grid (today unless another day was picked). */
  selected: number
  locale: Locale
  addressForm: AddressForm
}

/** The 7 days of the current program week (story 013): weekday, date, state marker. */
export function DayGrid({ cells, week, selected, locale, addressForm }: Props) {
  const t = createTranslator({
    locale,
    messages: messagesFor(locale, addressForm),
    namespace: 'StudyToday',
  })

  return (
    <div className={styles.wrap}>
      <ol className={styles.grid} aria-label={t('gridLabel', { week })}>
        {cells.map((cell) => {
          const date = formatCalendarDate(cell.date, locale)
          const isToday = cell.state === 'today'
          return (
            <li key={cell.programDay} className={styles.item}>
              <Link
                href={isToday ? '/study' : { pathname: '/study', query: { day: cell.programDay } }}
                className={styles.cell}
                data-state={cell.state}
                aria-current={cell.programDay === selected ? 'date' : undefined}
                aria-label={t('cellLabel', {
                  day: cell.programDay,
                  date: date.long,
                  state: t(`states.${cell.state}`),
                })}
              >
                <span className={styles.weekday} aria-hidden="true">
                  {date.weekday}
                </span>
                <span className={styles.date} aria-hidden="true">
                  {date.dayOfMonth}
                </span>
                <span className={styles.mark} aria-hidden="true">
                  {DAY_MARKERS[cell.state] || ' '}
                </span>
              </Link>
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
