import { hasText } from '@payloadcms/richtext-lexical/shared'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import { IBM_Plex_Sans, Newsreader } from 'next/font/google'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { CloseDayCell } from '@/components/CloseDayCell/CloseDayCell'
import { currentAdmin } from '@/features/auth/current-user'
import { dayNumberOn, percent, summarize } from '@/features/challenge/progress'
import { getPublicChallenge } from '@/features/challenge/queries'
import { alternatesFor } from '@/i18n/alternates'
import { routing } from '@/i18n/routing'
import { getPayloadClient } from '@/lib/payload'
import styles from './page.module.css'

const sans = IBM_Plex_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-tracker-sans',
})
const serif = Newsreader({ subsets: ['latin'], weight: ['500'], variable: '--font-tracker-serif' })
// Fresh reads on every reload, including changes made in the admin and local-midnight rollover.
export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ locale: string; slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Challenge' })
  return { title: t('title'), alternates: alternatesFor(`/challenge/${slug}`, locale) }
}
const symbols = { closed: '✓', today: '●', missed: '—', future: '○' }
export default async function ChallengePage({ params }: Props) {
  const { locale, slug } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const payload = await getPayloadClient()
  const result = await getPublicChallenge(payload, slug, locale)
  if (!result) notFound()
  const { challenge, days } = result
  // Only decides whether to render the form; the action re-verifies the session on the server.
  const isAdmin = Boolean(await currentAdmin(payload, await headers()))
  const t = await getTranslations({ locale, namespace: 'Challenge' })
  const now = new Date()
  const summary = summarize(challenge, days, now)
  const rawToday = dayNumberOn(now, challenge.startDate, challenge.timeZone)
  const number = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value))
  const bars = [
    {
      label: t('minutes', {
        done: number(summary.minutesDone),
        target: number(summary.minutesTarget),
        hours: number(summary.minutesDone / 60),
        targetHours: number(summary.minutesTarget / 60),
      }),
      done: summary.minutesDone,
      target: summary.minutesTarget,
    },
    {
      label: t('videos', { done: summary.videosPublished, target: summary.videosTarget }),
      done: summary.videosPublished,
      target: summary.videosTarget,
    },
    {
      label: t('sessions', { done: summary.sessionsDone, target: summary.sessionsPlanned }),
      done: summary.sessionsDone,
      target: summary.sessionsPlanned,
    },
  ]
  return (
    <article className={`${styles.page} ${sans.variable} ${serif.variable}`}>
      <header>
        <p>{t('title')}</p>
        <h1>{challenge.title}</h1>
        <p data-countdown={summary.status}>
          {summary.status === 'not-started'
            ? t('starts', { date: date(challenge.startDate) })
            : summary.status === 'finished'
              ? t('finished')
              : t('remaining', { days: summary.daysLeft })}
        </p>
      </header>
      <div className={styles.progress}>
        {bars.map(({ label, done, target }, index) => (
          <div key={index}>
            <label htmlFor={`progress-${index}`}>{label}</label>
            <progress
              id={`progress-${index}`}
              aria-label={label}
              max={100}
              value={percent(done, target)}
            />
          </div>
        ))}
      </div>
      <ul className={styles.legend}>
        {Object.entries(symbols).map(([state, symbol]) => (
          <li key={state}>
            <span aria-hidden="true">{symbol}</span> {t(state as keyof typeof symbols)}
          </li>
        ))}
      </ul>
      <div className={styles.blocks}>
        {challenge.videos?.map((video, index) => (
          <section key={video.id ?? index} data-block={index + 1}>
            <h2>{t('video', { number: index + 1 })}</h2>
            <h3>{video.title}</h3>
            {video.youtubeUrl && video.publishedAt && new Date(video.publishedAt) <= now ? (
              <a href={video.youtubeUrl}>{t('watch')}</a>
            ) : null}
            <ol className={styles.grid}>
              {Array.from({ length: challenge.blockDays }, (_, offset) => {
                const dayNumber = index * challenge.blockDays + offset + 1
                const day = days.find((item) => item.dayNumber === dayNumber)
                const state = day?.closedAt
                  ? 'closed'
                  : dayNumber === summary.todayNumber
                    ? 'today'
                    : dayNumber < rawToday
                      ? 'missed'
                      : 'future'
                const label = t('day', { number: dayNumber, state: t(state) })
                const cell = (
                  <>
                    <span>{dayNumber}</span>
                    <span aria-hidden="true">{symbols[state]}</span>
                    <span className="visually-hidden">{label}</span>
                  </>
                )
                const calendarDate = new Date(`${challenge.startDate.slice(0, 10)}T12:00:00Z`)
                calendarDate.setUTCDate(calendarDate.getUTCDate() + dayNumber - 1)
                const detail = day?.closedAt ? (
                  <div className={styles.detail}>
                    <time dateTime={calendarDate.toISOString().slice(0, 10)}>
                      {date(calendarDate.toISOString())}
                    </time>
                    <p>{t('dayMinutes', { minutes: day.minutes })}</p>
                    {day.notes ? <p>{day.notes}</p> : null}
                  </div>
                ) : null
                return (
                  <li key={dayNumber} data-day={dayNumber} data-state={state}>
                    {isAdmin && state !== 'future' ? (
                      <CloseDayCell
                        slug={challenge.slug}
                        dayNumber={dayNumber}
                        defaultMinutes={challenge.dailyMinutes}
                        minutes={day?.closedAt ? day.minutes : undefined}
                        notes={day?.closedAt ? (day.notes ?? undefined) : undefined}
                        label={label}
                        summary={cell}
                        summaryClassName={styles.cell}
                      >
                        {detail}
                      </CloseDayCell>
                    ) : day?.closedAt ? (
                      <details>
                        <summary className={styles.cell} aria-label={label}>
                          {cell}
                        </summary>
                        {detail}
                      </details>
                    ) : (
                      <div
                        className={styles.cell}
                        aria-label={label}
                        aria-current={state === 'today' ? 'date' : undefined}
                      >
                        {cell}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>
        ))}
      </div>
      {hasText(challenge.rules) ? (
        <section data-rules className={styles.rules}>
          <h2>{t('rules')}</h2>
          <RichText data={challenge.rules} />
        </section>
      ) : null}
    </article>
  )
}
