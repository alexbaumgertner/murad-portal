import type { Metadata } from 'next'
import { createTranslator, hasLocale } from 'next-intl'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { currentStudent } from '@/features/auth/current-user'
import { getStudentWeek } from '@/features/student-plan/queries'
import { messagesFor, parseAddressForm } from '@/i18n/address-form'
import { Link, redirect } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getPayloadClient } from '@/lib/payload'

import shared from '../page.module.css'
import styles from './page.module.css'

// Per-student page: always read the session.
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ week?: string | string[] }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = createTranslator({
    locale,
    messages: messagesFor(locale, 'ty'),
    namespace: 'StudyPlan',
  })
  return { title: t('title'), robots: { index: false } }
}

/**
 * `/study/weeks` — «Все недели» (story 018, Q7): every week of her personal plan, read-only. The
 * current week opens first; `?week=N` opens another. The full week view with slots is story 013.
 */
export default async function StudyWeeksPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const payload = await getPayloadClient()
  const student = await currentStudent(payload, await headers())
  if (!student) return redirect({ href: '/login', locale })

  const { week: weekParam } = await searchParams
  const asked = Number(Array.isArray(weekParam) ? weekParam[0] : weekParam)
  const view = await getStudentWeek(payload, student, locale, asked || undefined)
  if (view.kind === 'none') return redirect({ href: '/study', locale })

  const t = createTranslator({
    locale,
    messages: messagesFor(locale, parseAddressForm(student.addressForm)),
    namespace: 'StudyPlan',
  })
  const weeks = Array.from({ length: view.totalWeeks }, (_, i) => i + 1)
  const empty = view.days.every((day) => day.tasks.length === 0)

  return (
    <div className={shared.page}>
      <header className={shared.header}>
        <h1 className={shared.title}>{t('title')}</h1>
        <Link href="/study" className={shared.back}>
          {t('back')}
        </Link>
        <p className={shared.lead}>{t('hint')}</p>
      </header>

      <nav aria-label={t('weeksNav')} className={styles.weeks}>
        {weeks.map((week) => (
          <Link
            key={week}
            href={{ pathname: '/study/weeks', query: { week } }}
            className={week === view.currentWeek ? styles.weekNow : styles.week}
            aria-current={week === view.week ? 'page' : undefined}
            aria-label={
              week === view.currentWeek ? t('weekCurrent', { week }) : t('week', { week })
            }
          >
            {week}
          </Link>
        ))}
      </nav>

      <section className={shared.section} aria-labelledby="week-title">
        <h2 id="week-title" className={shared.today}>
          {t('week', { week: view.week })}
        </h2>
        {empty ? (
          <p className={shared.lead}>{t('empty')}</p>
        ) : (
          <ol className={styles.days}>
            {view.days.map((day) => (
              <li key={day.day} className={styles.day}>
                <h3 className={styles.dayTitle}>{t('day', { day: day.programDay })}</h3>
                {day.tasks.length === 0 ? (
                  <p className={styles.dayEmpty}>{t('dayEmpty')}</p>
                ) : (
                  <ul className={styles.tasks}>
                    {day.tasks.map((task) => (
                      <li key={task.id}>{task.text}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
