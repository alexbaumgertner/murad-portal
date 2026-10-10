import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { challengeListView } from '@/features/challenge/list'
import { listPublicChallenges } from '@/features/challenge/queries'
import { alternatesFor } from '@/i18n/alternates'
import { Link, redirect } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getPayloadClient } from '@/lib/payload'
import styles from './page.module.css'

// Rendered per request, like the tracker page: progress changes with every closed day.
export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Challenge' })
  return { title: t('listTitle'), alternates: alternatesFor('/challenge', locale) }
}

export default async function ChallengeListPage({ params }: Props) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const payload = await getPayloadClient()
  const view = challengeListView(await listPublicChallenges(payload, locale))
  if (view.kind === 'redirect') return redirect({ href: `/challenge/${view.slug}`, locale })

  const t = await getTranslations({ locale, namespace: 'Challenge' })
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value))
  const number = (value: number) => new Intl.NumberFormat(locale).format(value)

  return (
    <main className={styles.page}>
      <h1>{t('listTitle')}</h1>
      {view.kind === 'empty' ? (
        <p data-empty>{t('listEmpty')}</p>
      ) : (
        <ul className={styles.list}>
          {view.items.map(({ challenge, summary }) => (
            <li key={challenge.id} data-challenge={challenge.slug}>
              <Link href={`/challenge/${challenge.slug}`}>
                <h2>{challenge.title}</h2>
                <p>{t('starts', { date: date(challenge.startDate) })}</p>
                <p data-status={summary.status}>
                  {summary.status === 'not-started'
                    ? t('statusNotStarted')
                    : summary.status === 'finished'
                      ? t('finished')
                      : t('dayOf', {
                          day: summary.todayNumber ?? 0,
                          total: challenge.durationDays,
                        })}
                </p>
                <p>
                  {t('minutesShort', {
                    done: number(summary.minutesDone),
                    target: number(summary.minutesTarget),
                  })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
