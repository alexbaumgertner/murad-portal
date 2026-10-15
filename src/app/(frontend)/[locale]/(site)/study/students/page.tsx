import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { createTranslator, hasLocale } from 'next-intl'

import { isOwner } from '@/access'
import { currentUser } from '@/features/auth/current-user'
import { listStudentDashboard } from '@/features/owner-progress/dashboard-queries'
import {
  applyFilter,
  FILTERS,
  parseFilter,
  type Signal,
} from '@/features/owner-progress/dashboard-shape'
import { formatCalendarDate } from '@/features/study-today/shape'
import { messagesFor } from '@/i18n/address-form'
import { PlannerWeekBar } from '@/components/PlannerWeekBar/PlannerWeekBar'
import { mondayOf } from '@/features/planner/shape'
import { Link } from '@/i18n/navigation'
import { signInUrl } from '@/features/owner-progress/sign-in'
import { routing } from '@/i18n/routing'
import { getPayloadClient } from '@/lib/payload'

import styles from './page.module.css'

// Per-viewer page: always read the session.
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ filter?: string | string[] }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = createTranslator({
    locale,
    messages: messagesFor(locale, 'ty'),
    namespace: 'OwnerProgress',
  })
  return { title: t('title'), robots: { index: false } }
}

const SIGNAL_ORDER: Signal[] = ['noPlanner', 'noTasks', 'idle', 'questions']

/**
 * Story 019 + 030: the owner's dashboard of every student: her planner, her program and who needs
 * help. Anonymous visitors go to the sign-in page, a signed-in student gets «not found», the owner
 * sees the list. Read-only.
 */
export default async function StudentsPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const payload = await getPayloadClient()
  const user = await currentUser(payload, await headers())
  if (!user) redirect(signInUrl(locale, '/study/students'))
  if (!isOwner(user)) notFound()

  const t = createTranslator({
    locale,
    messages: messagesFor(locale, 'ty'),
    namespace: 'OwnerProgress',
  })
  const filter = parseFilter((await searchParams).filter)
  const all = await listStudentDashboard(payload, user, locale)
  const rows = applyFilter(all, filter)
  const thisMonday = mondayOf(new Date().toISOString().slice(0, 10))

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.lead}>{t('lead')}</p>
      </header>

      {all.length === 0 ? (
        <p className={styles.muted}>{t('empty')}</p>
      ) : (
        <>
          <nav className={styles.filters} aria-label={t('filtersLabel')}>
            {FILTERS.map((name) => (
              <Link
                key={name}
                href={name === 'all' ? '/study/students' : `/study/students?filter=${name}`}
                className={styles.filter}
                aria-current={name === filter ? 'page' : undefined}
              >
                {t(`filter.${name}`)}
                <span className={styles.count}>{applyFilter(all, name).length}</span>
              </Link>
            ))}
          </nav>

          {rows.length === 0 ? (
            <p className={styles.muted}>
              {t('noMatch')}{' '}
              <Link href="/study/students" className={styles.link}>
                {t('showAll')}
              </Link>
            </p>
          ) : (
            <ul className={styles.list}>
              {rows.map((row) => (
                <li key={row.studentId} className={styles.row}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.name}>{row.name}</h2>
                    {row.signals.length > 0 ? (
                      <ul className={styles.signals} aria-label={t('signalsLabel')}>
                        {SIGNAL_ORDER.filter((signal) => row.signals.includes(signal)).map(
                          (signal) => (
                            <li key={signal} className={styles.signal} data-signal={signal}>
                              {t(`signal.${signal}`)}
                            </li>
                          ),
                        )}
                      </ul>
                    ) : null}
                  </div>

                  {row.hasPlanner ? (
                    <div className={styles.planner}>
                      {row.currentWeek != null && row.weekStart ? (
                        <span>
                          {t('weekOf', {
                            week: row.currentWeek,
                            date: formatCalendarDate(row.weekStart, locale).long,
                          })}
                        </span>
                      ) : (
                        <span className={styles.muted}>{t('noCurrentWeek')}</span>
                      )}
                      {row.stats && row.stats.total > 0 ? (
                        <span className={styles.progress}>
                          <progress
                            value={row.stats.done}
                            max={row.stats.total}
                            aria-label={t('weekProgress')}
                          />
                          <span>
                            {t('tasksDone', { done: row.stats.done, total: row.stats.total })} ·{' '}
                            {row.percent}%
                          </span>
                        </span>
                      ) : (
                        <span className={styles.muted}>{t('noWeekTasks')}</span>
                      )}
                      <span className={styles.muted}>
                        {row.lastTick
                          ? t('lastTick', { date: formatCalendarDate(row.lastTick, locale).long })
                          : t('noTick')}
                      </span>
                    </div>
                  ) : (
                    <>
                      <p className={styles.muted}>{t('plannerNone')}</p>
                      <PlannerWeekBar kind="create" studentId={row.studentId} today={thisMonday} />
                    </>
                  )}

                  <Link
                    href={`/study/planner?student=${row.studentId}`}
                    className={styles.action}
                    aria-label={t('openPlanner', { name: row.name })}
                  >
                    {t('openPlannerShort')}
                  </Link>

                  {row.program ? (
                    <Link
                      href={`/study/students/${row.program.enrollmentId}`}
                      className={styles.card}
                      aria-label={t('open', { name: row.name })}
                    >
                      <span className={styles.cardHead}>
                        <span className={styles.programTitle}>
                          {row.program.programTitle} ·{' '}
                          {t('levels', { from: row.program.levelFrom, to: row.program.levelTo })}
                        </span>
                        <span className={styles.status}>{t(`status.${row.program.status}`)}</span>
                      </span>
                      {row.program.totals && row.program.today != null ? (
                        <>
                          <span>
                            {t('dayOf', {
                              day: Math.min(row.program.today, row.program.totalDays),
                              total: row.program.totalDays,
                            })}
                          </span>
                          <dl className={styles.stats}>
                            <div className={styles.stat}>
                              <dt>{t('statDone')}</dt>
                              <dd>{row.program.totals.done}</dd>
                            </div>
                            <div className={styles.stat}>
                              <dt>{t('statMissed')}</dt>
                              <dd>{row.program.totals.missed}</dd>
                            </div>
                            <div className={styles.stat}>
                              <dt>{t('statMinutes')}</dt>
                              <dd>{row.program.totals.minutes}</dd>
                            </div>
                          </dl>
                          <span className={styles.muted}>
                            {row.program.lastStudyDate
                              ? t('lastStudy', {
                                  date: formatCalendarDate(row.program.lastStudyDate, locale).long,
                                })
                              : t('noStudy')}
                          </span>
                        </>
                      ) : (
                        <span className={styles.muted}>{t('notStarted')}</span>
                      )}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
