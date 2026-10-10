import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { createTranslator, hasLocale } from 'next-intl'

import { isOwner } from '@/access'
import { currentUser } from '@/features/auth/current-user'
import { listStudentSummaries } from '@/features/owner-progress/queries'
import { formatCalendarDate } from '@/features/study-today/shape'
import { messagesFor } from '@/i18n/address-form'
import { Link } from '@/i18n/navigation'
import { signInUrl } from '@/features/owner-progress/sign-in'
import { routing } from '@/i18n/routing'
import { getPayloadClient } from '@/lib/payload'

import styles from './page.module.css'

// Per-viewer page: always read the session.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ locale: string }> }

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

/**
 * Story 019: the owner's view of every student. Anonymous visitors go to the sign-in page, a
 * signed-in student gets «not found» (the page is not hers), the owner sees the list.
 */
export default async function StudentsPage({ params }: PageProps) {
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
  const rows = await listStudentSummaries(payload, user, locale)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.lead}>{t('lead')}</p>
      </header>

      {rows.length === 0 ? (
        <p className={styles.muted}>{t('empty')}</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.enrollmentId}>
              <Link
                href={`/study/students/${row.enrollmentId}`}
                className={styles.card}
                aria-label={t('open', { name: row.name })}
              >
                <span className={styles.cardHead}>
                  <span className={styles.name}>{row.name}</span>
                  <span className={styles.status}>{t(`status.${row.status}`)}</span>
                </span>
                <span className={styles.muted}>
                  {row.programTitle} · {t('levels', { from: row.levelFrom, to: row.levelTo })}
                </span>
                {row.totals && row.today != null ? (
                  <>
                    <span>
                      {t('dayOf', {
                        day: Math.min(row.today, row.totalDays),
                        total: row.totalDays,
                      })}
                    </span>
                    <dl className={styles.stats}>
                      <div className={styles.stat}>
                        <dt>{t('statDone')}</dt>
                        <dd>{row.totals.done}</dd>
                      </div>
                      <div className={styles.stat}>
                        <dt>{t('statMissed')}</dt>
                        <dd>{row.totals.missed}</dd>
                      </div>
                      <div className={styles.stat}>
                        <dt>{t('statMinutes')}</dt>
                        <dd>{row.totals.minutes}</dd>
                      </div>
                    </dl>
                    <span className={styles.muted}>
                      {row.lastStudyDate
                        ? t('lastStudy', {
                            date: formatCalendarDate(row.lastStudyDate, locale).long,
                          })
                        : t('noStudy')}
                    </span>
                  </>
                ) : (
                  <span className={styles.muted}>{t('notStarted')}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
