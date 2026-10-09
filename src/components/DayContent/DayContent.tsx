import { createTranslator } from 'next-intl'
import type { ReactNode } from 'react'

import type { LoggedSlot } from '@/features/slot-timer/shape'
import type { SlotView } from '@/features/study-today/queries'
import { messagesFor, type AddressForm } from '@/i18n/address-form'
import type { Locale } from '@/i18n/routing'

import styles from './DayContent.module.css'

type Props = {
  slots: SlotView[]
  tasks: string[]
  locale: Locale
  addressForm: AddressForm
  /** Rest day with nothing to show: «Сегодня отдых» for today, «Отдых» in lists. */
  restLabel?: 'restToday' | 'rest'
  /** Today's slots with their timers (story 014); replaces the plain list. */
  timers?: ReactNode
  /** What was logged on this day, shown on each slot (story 014); ignored when `timers` is given. */
  logs?: LoggedSlot[]
  /** Extra controls under a slot of the plain list, e.g. «Отметить вручную» (story 015). */
  renderMark?: (slotIndex: number, minutes: number) => ReactNode
}

/** The slots of a day (name, minimum, description) and its personal tasks below (story 013). */
export function DayContent({
  slots,
  tasks,
  locale,
  addressForm,
  restLabel = 'rest',
  timers,
  logs = [],
  renderMark,
}: Props) {
  const t = createTranslator({
    locale,
    messages: messagesFor(locale, addressForm),
    namespace: 'StudyToday',
  })

  const tt = createTranslator({
    locale,
    messages: messagesFor(locale, addressForm),
    namespace: 'StudyTimer',
  })

  return (
    <div className={styles.content}>
      {slots.length === 0 && tasks.length === 0 ? (
        <p className={styles.muted}>{t(restLabel)}</p>
      ) : null}

      {timers && slots.length > 0 ? timers : null}

      {!timers && slots.length > 0 ? (
        <ul className={styles.slots}>
          {slots.map((slot, index) => {
            const log = logs.find((entry) => entry.slotIndex === index)
            return (
              <li key={index} className={styles.slot}>
                <span className={styles.slotName}>{slot.name}</span>
                <span className={styles.slotMin}>
                  {log?.completed
                    ? tt('done')
                    : log && log.minutes > 0
                      ? tt('progress', { minutes: log.minutes, min: slot.minutes })
                      : t('slotMinimum', { minutes: slot.minutes })}
                </span>
                {slot.description ? (
                  <span className={styles.slotText}>{slot.description}</span>
                ) : null}
                {renderMark ? renderMark(index, log?.minutes ?? 0) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {tasks.length > 0 ? (
        <>
          <h4 className={styles.subtitle}>{t('tasksTitle')}</h4>
          <ul className={styles.tasks}>
            {tasks.map((task, index) => (
              <li key={index}>{task}</li>
            ))}
          </ul>
        </>
      ) : slots.length > 0 ? (
        <p className={styles.muted}>{t('tasksEmpty')}</p>
      ) : null}
    </div>
  )
}
