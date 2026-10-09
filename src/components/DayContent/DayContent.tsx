import { createTranslator } from 'next-intl'

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
}

/** The slots of a day (name, minimum, description) and its personal tasks below (story 013). */
export function DayContent({ slots, tasks, locale, addressForm, restLabel = 'rest' }: Props) {
  const t = createTranslator({
    locale,
    messages: messagesFor(locale, addressForm),
    namespace: 'StudyToday',
  })

  return (
    <div className={styles.content}>
      {slots.length === 0 && tasks.length === 0 ? (
        <p className={styles.muted}>{t(restLabel)}</p>
      ) : null}

      {slots.length > 0 ? (
        <ul className={styles.slots}>
          {slots.map((slot, index) => (
            <li key={index} className={styles.slot}>
              <span className={styles.slotName}>{slot.name}</span>
              <span className={styles.slotMin}>{t('slotMinimum', { minutes: slot.minutes })}</span>
              {slot.description ? (
                <span className={styles.slotText}>{slot.description}</span>
              ) : null}
            </li>
          ))}
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
