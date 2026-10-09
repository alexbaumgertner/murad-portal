import type { Metadata } from 'next'
import { createTranslator, hasLocale } from 'next-intl'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { DayContent } from '@/components/DayContent/DayContent'
import { DayMarker } from '@/components/DayMarker/DayMarker'
import { currentStudent } from '@/features/auth/current-user'
import { getStudentWeek } from '@/features/student-plan/queries'
import { getStudyOverview } from '@/features/study-today/queries'
import { formatCalendarDate, weekCells, weekCount, weekOf } from '@/features/study-today/shape'
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
 * `/study/weeks` — «Все недели» (stories 018 and 013, Q7): every week of the program with its
 * done/total count, and one week's slots and personal tasks, read-only. The current week opens
 * first; `?week=N` opens another, a future one included.
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

  const overview = await getStudyOverview(payload, student, locale)
  if (overview.kind !== 'ready') return redirect({ href: '/study', locale })

  const addressForm = parseAddressForm(student.addressForm)
  const messages = messagesFor(locale, addressForm)
  const t = createTranslator({ locale, messages, namespace: 'StudyPlan' })
  const weeks = Array.from({ length: view.totalWeeks }, (_, i) => i + 1)
  const currentWeek = weekOf(overview.today)
  const cells = weekCells({
    week: view.week,
    startDate: overview.startDate,
    today: overview.today,
    template: overview.template,
    progress: overview.progress,
  })
  const empty =
    view.days.every((day) => day.tasks.length === 0) &&
    overview.template.every((day) => day.slots.length === 0)

  return (
    <div className={shared.page}>
      <header className={shared.header}>
        <h1 className={shared.title}>{t('title')}</h1>
        <Link href="/study" className={shared.back}>
          {t('back')}
        </Link>
        <p className={shared.lead}>{t('hint')}</p>
      </header>

      <nav aria-label={t('weeksNav')}>
        <ol className={styles.weeks}>
          {weeks.map((week) => {
            const isCurrent = week === currentWeek
            const past = week < currentWeek
            const count = weekCount({
              week,
              template: overview.template,
              progress: overview.progress,
            })
            return (
              <li key={week} className={styles.weekItem}>
                <Link
                  href={{ pathname: '/study/weeks', query: { week } }}
                  className={isCurrent ? styles.weekNow : styles.week}
                  aria-current={week === view.week ? 'page' : undefined}
                  aria-label={
                    isCurrent
                      ? t('weekCurrent', { week })
                      : past
                        ? t('weekProgress', { week, ...count })
                        : t('week', { week })
                  }
                >
                  <span aria-hidden="true">{week}</span>
                  {past ? (
                    <span className={styles.count} aria-hidden="true">
                      {t('weekProgressShort', count)}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ol>
      </nav>

      <section className={shared.section} aria-labelledby="week-title">
        <h2 id="week-title" className={shared.today}>
          {t('week', { week: view.week })}
        </h2>
        {empty ? (
          <p className={shared.lead}>{t('empty')}</p>
        ) : (
          <ol className={styles.days}>
            {view.days.map((day, index) => {
              const cell = cells[index]!
              return (
                <li key={day.day} className={styles.day}>
                  <h3 className={styles.dayTitle}>
                    {t('dayDate', {
                      day: day.programDay,
                      date: formatCalendarDate(cell.date, locale).long,
                    })}{' '}
                    <DayMarker state={cell.state} locale={locale} addressForm={addressForm} />
                  </h3>
                  <DayContent
                    slots={overview.template[index]?.slots ?? []}
                    tasks={day.tasks.map((task) => task.text)}
                    locale={locale}
                    addressForm={addressForm}
                  />
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
