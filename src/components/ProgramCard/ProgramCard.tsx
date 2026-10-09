import { RichText } from '@payloadcms/richtext-lexical/react'
import { createTranslator } from 'next-intl'

import type { ProgramView } from '@/features/enrollments/queries'
import { messagesFor, type AddressForm } from '@/i18n/address-form'
import type { Locale } from '@/i18n/routing'

import styles from './ProgramCard.module.css'

type Props = {
  program: ProgramView
  locale: Locale
  addressForm: AddressForm
  /** The «Начать» control; the card itself stays a Server Component. */
  children?: React.ReactNode
}

/** The assigned program (story 012): levels, length, summary, materials and the week template. */
export function ProgramCard({ program, locale, addressForm, children }: Props) {
  const t = createTranslator({
    locale,
    messages: messagesFor(locale, addressForm),
    namespace: 'StudyProgram',
  })

  return (
    <section className={styles.card} aria-labelledby="program-title">
      <p className={styles.eyebrow}>{t('programTitle')}</p>
      <div className={styles.head}>
        <span className={styles.badge}>
          {t('levels', { from: program.levelFrom, to: program.levelTo })}
        </span>
        <span className={styles.weeks}>{t('weeks', { count: program.durationWeeks })}</span>
      </div>
      <h2 id="program-title" className={styles.title}>
        {program.title}
      </h2>
      {program.summary ? <p className={styles.summary}>{program.summary}</p> : null}

      {program.materials ? (
        <div className={styles.block}>
          <h3 className={styles.subtitle}>{t('materials')}</h3>
          <RichText data={program.materials} className={styles.rich} />
        </div>
      ) : null}

      <div className={styles.block}>
        <h3 className={styles.subtitle}>{t('week')}</h3>
        <p className={styles.hint}>{t('weekHint')}</p>
        <ol className={styles.days}>
          {program.days.map((day, index) => (
            <li key={index} className={styles.day}>
              <span className={styles.dayName}>{t('day', { day: index + 1 })}</span>
              {day.slots.length === 0 ? (
                <span className={styles.rest}>{t('rest')}</span>
              ) : (
                <ul className={styles.slots}>
                  {day.slots.map((slot, i) => (
                    <li key={i}>{t('slot', { name: slot.name, minutes: slot.minutes })}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </div>

      {children}
    </section>
  )
}
