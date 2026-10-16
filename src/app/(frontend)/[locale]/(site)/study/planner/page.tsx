import type { Metadata } from 'next'
import { createTranslator, hasLocale } from 'next-intl'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { isOwner } from '@/access'
import { PlannerShell } from '@/components/PlannerShell/PlannerShell'
import { PlannerBoard } from '@/components/PlannerBoard/PlannerBoard'
import { PlannerTaskTypes } from '@/components/PlannerTaskTypes/PlannerTaskTypes'
import { PlannerProgressSettings } from '@/components/PlannerProgressSettings/PlannerProgressSettings'
import { PlannerWeekNav } from '@/components/PlannerWeekNav/PlannerWeekNav'
import { PlannerWeekBar } from '@/components/PlannerWeekBar/PlannerWeekBar'
import { currentUser } from '@/features/auth/current-user'
import { getPlannerView } from '@/features/planner/queries'
import { mondayOf, weekDates } from '@/features/planner/shape'
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
      <Link href="/study" className={`${shared.back} ${styles.noPrint}`}>
        {t('back')}
      </Link>
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
        <PlannerShell
          plannerId={view.plannerId}
          initial={view.appearance}
          isOwner={owner}
          ownerPanels={
            owner ? (
              <>
                <PlannerTaskTypes plannerId={view.plannerId} initial={view.taskTypes} />
                <PlannerProgressSettings plannerId={view.plannerId} initial={view.settings} />
              </>
            ) : null
          }
        >
          <div className={styles.noPrint}>
            <PlannerWeekNav
              weeks={view.weeks.map((week) => {
                const dates = weekDates(view.baseDate, week.index)
                return {
                  id: week.id,
                  index: week.index,
                  label: t('header.week', { n: String(week.index + 1).padStart(2, '0') }),
                  from: dates[0]!,
                  to: dates[6]!,
                }
              })}
              activeId={view.active.id}
              studentId={owner ? studentId : undefined}
            />
          </div>
          <PlannerBoard
            key={view.active.id}
            plannerId={view.plannerId}
            header={view.header}
            notes={view.active.notes}
            weekId={view.active.id}
            weekIndex={view.active.index}
            rowCount={view.active.rowCount}
            dates={view.active.dates}
            cells={view.active.cells}
            taskTypes={view.taskTypes}
            canEdit={owner}
            baseDate={view.baseDate}
            weekIndexes={view.weeks.map((week) => week.index)}
            otherTasks={view.otherTasks}
            settings={view.settings}
            today={view.today}
          />
          {owner ? (
            <div className={styles.noPrint}>
              <PlannerWeekBar
                kind="owner"
                plannerId={view.plannerId}
                weekId={view.active.id}
                lastWeek={view.weeks.length <= 1}
              />
            </div>
          ) : null}
        </PlannerShell>
      )}
    </div>
  )
}
