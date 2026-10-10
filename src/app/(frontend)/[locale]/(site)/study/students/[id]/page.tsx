import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { createTranslator, hasLocale } from 'next-intl'

import { isOwner } from '@/access'
import { DayGrid } from '@/components/DayGrid/DayGrid'
import { currentUser } from '@/features/auth/current-user'
import { getStudentDetail } from '@/features/owner-progress/queries'
import { formatCalendarDate } from '@/features/study-today/shape'
import { messagesFor } from '@/i18n/address-form'
import { Link } from '@/i18n/navigation'
import { signInUrl } from '@/features/owner-progress/sign-in'
import { routing } from '@/i18n/routing'
import { getPayloadClient } from '@/lib/payload'

import styles from '../page.module.css'

// Per-viewer page: always read the session.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ locale: string; id: string }> }

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

/** Story 019: one student for the owner: her numbers, this and the last week, her comments. */
export default async function StudentPage({ params }: PageProps) {
  const { locale, id } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const payload = await getPayloadClient()
  const user = await currentUser(payload, await headers())
  if (!user) redirect(signInUrl(locale, `/study/students/${id}`))
  if (!isOwner(user)) notFound()

  const enrollmentId = /^\d+$/.test(id) ? Number(id) : NaN
  if (!Number.isSafeInteger(enrollmentId)) notFound()
  const detail = await getStudentDetail(payload, user, enrollmentId, locale)
  if (!detail) notFound()

  const messages = messagesFor(locale, 'ty')
  const t = createTranslator({ locale, messages, namespace: 'OwnerProgress' })
  const { summary, weeks, comments } = detail

  return (
    <div className={styles.page}>
      <Link href="/study/students" className={styles.back}>
        {t('back')}
      </Link>
      <header className={styles.header}>
        <h1 className={styles.title}>{summary.name}</h1>
        <p className={styles.muted}>
          {summary.programTitle} · {t('levels', { from: summary.levelFrom, to: summary.levelTo })} ·{' '}
          {t(`status.${summary.status}`)}
        </p>
      </header>

      {summary.totals && summary.today != null ? (
        <>
          <p>
            {t('dayOf', {
              day: Math.min(summary.today, summary.totalDays),
              total: summary.totalDays,
            })}
          </p>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>{t('statDone')}</dt>
              <dd>{summary.totals.done}</dd>
            </div>
            <div className={styles.stat}>
              <dt>{t('statMissed')}</dt>
              <dd>{summary.totals.missed}</dd>
            </div>
            <div className={styles.stat}>
              <dt>{t('statMinutes')}</dt>
              <dd>{summary.totals.minutes}</dd>
            </div>
          </dl>
          <p className={styles.muted}>
            {summary.lastStudyDate
              ? t('lastStudy', { date: formatCalendarDate(summary.lastStudyDate, locale).long })
              : t('noStudy')}
          </p>
        </>
      ) : (
        <p className={styles.muted}>{t('notStarted')}</p>
      )}

      {weeks.length > 0 ? (
        <section className={styles.section} aria-labelledby="weeks">
          <h2 id="weeks" className={styles.sectionTitle}>
            {t('weeksTitle')}
          </h2>
          {weeks.map(({ week, cells }) => (
            <div key={week} className={styles.section}>
              <h3 className={styles.weekTitle}>{t('weekTitle', { week })}</h3>
              <DayGrid
                cells={cells}
                week={week}
                selected={0}
                locale={locale}
                addressForm="ty"
                readOnly
              />
            </div>
          ))}
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="comments">
        <h2 id="comments" className={styles.sectionTitle}>
          {t('commentsTitle')}
        </h2>
        {comments.length === 0 ? (
          <p className={styles.muted}>{t('noComments')}</p>
        ) : (
          <ul className={styles.comments}>
            {comments.map((comment) => (
              <li key={comment.date} className={styles.comment}>
                <span className={styles.commentMeta}>
                  {comment.programDay != null
                    ? t('commentMeta', {
                        date: formatCalendarDate(comment.date, locale).long,
                        day: comment.programDay,
                      })
                    : t('commentMetaNoDay', {
                        date: formatCalendarDate(comment.date, locale).long,
                      })}
                </span>
                <p className={styles.commentText}>{comment.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
