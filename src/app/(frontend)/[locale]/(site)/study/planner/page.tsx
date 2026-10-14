import type { Metadata } from 'next'
import { createTranslator, hasLocale } from 'next-intl'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { isOwner } from '@/access'
import { PlannerGrid } from '@/components/PlannerGrid/PlannerGrid'
import { PlannerWeekBar } from '@/components/PlannerWeekBar/PlannerWeekBar'
import { currentUser } from '@/features/auth/current-user'
import { getPlannerView } from '@/features/planner/queries'
import { mondayOf, weekLabel } from '@/features/planner/shape'
import { messagesFor, parseAddressForm } from '@/i18n/address-form'
import { Link, redirect } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getPayloadClient } from '@/lib/payload'

import shared from '../page.module.css'
import styles from './page.module.css'

// Per-viewer page: always read the session.
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ student?: string; week?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = createTranslator({ locale, messages: messagesFor(locale, 'ty'), namespace: 'Planner' })
  return { title: t('title'), robots: { index: false } }
}

/**
 * `/study/planner` — the weekly planner (story 022). A student sees her own; the owner opens a
 * student's with `?student=ID` and can create it, add and delete weeks, rows and tasks.
 */
export default async function PlannerPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const payload = await getPayloadClient()
  const user = await currentUser(payload, await headers())
  if (!user) return redirect({ href: '/login', locale })

  const query = await searchParams
  const owner = isOwner(user)
  const studentId = owner ? Number(query.student) : Number(user.id)
  if (!Number.isInteger(studentId) || studentId < 1) return redirect({ href: '/study', locale })

  const messages = messagesFor(locale, parseAddressForm(user.addressForm))
  const t = createTranslator({ locale, messages, namespace: 'Planner' })
  const weekParam = query.week === undefined ? undefined : Number(query.week)
  const view = await getPlannerView(payload, user, studentId, weekParam)

  return (
    <div className={styles.page}>
      <header className={shared.header}>
        <h1 className={shared.title}>{t('title')}</h1>
        <Link href="/study" className={shared.back}>
          {t('back')}
        </Link>
      </header>
      {!view ? (
        owner ? (
          <PlannerWeekBar
            kind="create"
            studentId={studentId}
            today={mondayOf(new Date().toISOString().slice(0, 10))}
          />
        ) : (
          <p className={shared.lead}>{t('none')}</p>
        )
      ) : (
        <>
          <nav aria-label={t('weeksNav')}>
            <ol className={styles.weeks}>
              {view.weeks.map((week) => (
                <li key={week.id}>
                  <Link
                    href={{
                      pathname: '/study/planner',
                      query: owner
                        ? { student: studentId, week: week.index }
                        : { week: week.index },
                    }}
                    className={styles.week}
                    aria-current={week.id === view.active.id ? 'page' : undefined}
                  >
                    {weekLabel(week.index)}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
          <PlannerGrid
            key={view.active.id}
            weekId={view.active.id}
            rowCount={view.active.rowCount}
            dates={view.active.dates}
            cells={view.active.cells}
            canEdit={owner}
          />
          {owner ? (
            <PlannerWeekBar
              kind="owner"
              plannerId={view.plannerId}
              weekId={view.active.id}
              lastWeek={view.weeks.length <= 1}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
