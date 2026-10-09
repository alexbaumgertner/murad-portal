import { createTranslator } from 'next-intl'

import { messagesFor, type AddressForm } from '@/i18n/address-form'
import type { Locale } from '@/i18n/routing'
import { DAY_MARKERS, type DayState } from '@/features/study-today/shape'

import styles from './DayMarker.module.css'

type Props = { state: DayState; locale: Locale; addressForm: AddressForm }

/** A day's state as a symbol plus a word for screen readers: never colour alone (story 013). */
export function DayMarker({ state, locale, addressForm }: Props) {
  const t = createTranslator({
    locale,
    messages: messagesFor(locale, addressForm),
    namespace: 'StudyToday',
  })
  return (
    <>
      <span className={styles.marker} data-state={state} aria-hidden="true">
        {DAY_MARKERS[state]}
      </span>
      <span className={styles.hidden}>{t(`states.${state}`)}</span>
    </>
  )
}
