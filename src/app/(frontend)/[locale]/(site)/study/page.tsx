import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createTranslator, hasLocale, NextIntlClientProvider } from 'next-intl'

import { DayComment } from '@/components/DayComment/DayComment'
import { DayContent } from '@/components/DayContent/DayContent'
import { DayGrid } from '@/components/DayGrid/DayGrid'
import { SlotTimers } from '@/components/SlotTimers/SlotTimers'
import { ManualMark } from '@/components/ManualMark/ManualMark'
import { ProgramCard } from '@/components/ProgramCard/ProgramCard'
import { StartProgram } from '@/components/StartProgram/StartProgram'
import { logoutAction } from '@/features/auth/actions'
import { currentStudent } from '@/features/auth/current-user'
import { getStudyView } from '@/features/enrollments/queries'
import { getDayComments } from '@/features/day-comments/queries'
import { getTimerState } from '@/features/slot-timer/service'
import { trackCompleted } from '@/features/slot-timer/track'
import { getStudentWeek } from '@/features/student-plan/queries'
import { getStudyOverview } from '@/features/study-today/queries'
import {
  formatCalendarDate,
  isOver,
  progressTotals,
  templateDayOf,
  trainingDaysIn,
  weekCells,
  weekOf,
} from '@/features/study-today/shape'
import { messagesFor, parseAddressForm, studentMessages } from '@/i18n/address-form'
import { Link, redirect } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getPayloadClient } from '@/lib/payload'

import styles from './page.module.css'

// Per-student page: always read the session.
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ day?: string | string[] }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = createTranslator({ locale, messages: messagesFor(locale, 'ty'), namespace: 'Study' })
  return { title: t('title'), robots: { index: false } }
}

/**
 * The student's home. Story 012: the placement result and the assigned program with «Начать»;
 * story 013: once started, «Сегодня» with the day's slots and tasks, the grid of the current
 * program week and the progress numbers. `?day=N` opens another day of this week, read-only.
 */
export default async function StudyPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const payload = await getPayloadClient()
  const student = await currentStudent(payload, await headers())
  if (!student) return redirect({ href: '/login', locale })
  // «Ты» or «вы» is her setting (story 011c); English ignores it.
  const addressForm = parseAddressForm(student.addressForm)
  const messages = messagesFor(locale, addressForm)
  const t = createTranslator({ locale, messages, namespace: 'Study' })
  const tp = createTranslator({ locale, messages, namespace: 'StudyProgram' })
  const tw = createTranslator({ locale, messages, namespace: 'StudyPlan' })
  const tt = createTranslator({ locale, messages, namespace: 'StudyToday' })
  const view = await getStudyView(payload, student, locale)
  // An assigned program shows the start card; otherwise a started (or just finished) one shows «Сегодня».
  // A timer left running is settled first (4-hour cap, minimum reached while the tab was closed),
  // so the numbers below already include it.
  const timer = view.kind === 'assigned' ? null : await getTimerState(payload, student, new Date())
  if (timer?.ok) await trackCompleted(timer.completedNow, true)
  const overview =
    view.kind === 'assigned'
      ? ({ kind: 'none' } as const)
      : await getStudyOverview(payload, student, locale)

  const ready = overview.kind === 'ready' ? overview : null
  const finished =
    ready != null && (ready.status === 'finished' || isOver(ready.today, ready.durationWeeks))
  const totals = ready
    ? progressTotals({
        today: ready.today,
        totalDays: ready.totalDays,
        template: ready.template,
        progress: ready.progress,
      })
    : null

  // The current week's grid, and the day shown below it: today, or a day picked with `?day=N`.
  let grid: ReturnType<typeof weekCells> = []
  let selected = 0
  let tasksOf: (programDay: number) => string[] = () => []
  if (ready && !finished) {
    const week = weekOf(ready.today)
    grid = weekCells({
      week,
      startDate: ready.startDate,
      today: ready.today,
      template: ready.template,
      progress: ready.progress,
    })
    const asked = Number((await searchParams).day)
    selected = grid.some((cell) => cell.programDay === asked) ? asked : ready.today
    const plan = await getStudentWeek(payload, student, locale, week)
    const days = plan.kind === 'plan' ? plan.days : []
    tasksOf = (programDay) =>
      days.find((day) => day.programDay === programDay)?.tasks.map((task) => task.text) ?? []
  }
  const selectedCell = grid.find((cell) => cell.programDay === selected)
  // Her private comment on the shown day: today or a past day only, never a future one (story 016).
  const commentable = ready != null && selectedCell != null && selected <= ready.today
  const comments = commentable ? await getDayComments(payload, student) : null

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {student.name ? t('greeting', { name: student.name }) : t('greetingAnonymous')}
        </h1>
        {view.kind === 'none' && !ready ? <p className={styles.lead}>{t('empty')}</p> : null}
        {view.kind === 'assigned' ? (
          <p className={styles.lead}>
            {view.placement.score
              ? tp('placementWithScore', {
                  test: view.placement.test ?? tp('testMurad'),
                  score: view.placement.score,
                  cefr: view.placement.cefr,
                })
              : tp('placementNoScore', {
                  test: view.placement.test ?? tp('testMurad'),
                  cefr: view.placement.cefr,
                })}
          </p>
        ) : null}
      </header>

      {view.kind === 'assigned' ? (
        <div className={styles.section}>
          <ProgramCard program={view.program} locale={locale} addressForm={addressForm}>
            <NextIntlClientProvider locale={locale} messages={studentMessages(locale, addressForm)}>
              <StartProgram
                program={tp('levels', { from: view.program.levelFrom, to: view.program.levelTo })}
              />
            </NextIntlClientProvider>
          </ProgramCard>
        </div>
      ) : null}

      {ready && totals ? (
        <section className={styles.section} aria-labelledby="progress-title">
          <p className={styles.lead}>
            {tp('levels', { from: ready.levelFrom, to: ready.levelTo })}
          </p>
          <h2 id="progress-title" className={styles.today}>
            {finished
              ? tt('finishedTitle')
              : tt('headerDay', {
                  day: ready.today,
                  total: ready.totalDays,
                  week: weekOf(ready.today),
                })}
          </h2>
          <p className={styles.lead}>
            {finished ? tt('finishedBody', { program: ready.programTitle }) : ready.programTitle}
          </p>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>{tt('statDone')}</dt>
              <dd data-testid="stat-done">{totals.done}</dd>
            </div>
            <div className={styles.stat}>
              <dt>{tt('statMissed')}</dt>
              <dd data-testid="stat-missed">{totals.missed}</dd>
            </div>
            <div className={styles.stat}>
              <dt>{tt('statMinutes')}</dt>
              <dd data-testid="stat-minutes">{totals.minutes}</dd>
            </div>
          </dl>
          {finished ? (
            <p className={styles.lead}>
              {tt('finishedTotals', {
                done: totals.done,
                total: trainingDaysIn(ready.durationWeeks, ready.template),
              })}
            </p>
          ) : null}
        </section>
      ) : null}

      {ready && !finished && selectedCell ? (
        <>
          <section className={styles.section} aria-labelledby="today-title">
            <h2 id="today-title" className={styles.today}>
              {selected === ready.today
                ? tt('title')
                : tt('dayHeading', {
                    day: selected,
                    date: formatCalendarDate(selectedCell.date, locale).long,
                  })}
            </h2>
            {selected !== ready.today ? (
              <Link href="/study" className={styles.back}>
                {tt('backToToday')}
              </Link>
            ) : null}
            <DayContent
              slots={ready.template[templateDayOf(selected) - 1]?.slots ?? []}
              tasks={tasksOf(selected)}
              locale={locale}
              addressForm={addressForm}
              restLabel={selected === ready.today ? 'restToday' : 'rest'}
              logs={ready.logs.get(selected)}
              renderMark={
                // Past days of a running program only; today has the same control among its timers.
                selected < ready.today && ready.status === 'active'
                  ? (slotIndex, minutes) => (
                      <NextIntlClientProvider
                        locale={locale}
                        messages={studentMessages(locale, addressForm)}
                      >
                        <ManualMark
                          programDay={selected}
                          slotIndex={slotIndex}
                          slotName={
                            ready.template[templateDayOf(selected) - 1]?.slots[slotIndex]?.name ??
                            ''
                          }
                          minutes={minutes}
                        />
                      </NextIntlClientProvider>
                    )
                  : undefined
              }
              timers={
                selected === ready.today && timer?.ok && ready.status === 'active' ? (
                  <NextIntlClientProvider
                    locale={locale}
                    messages={studentMessages(locale, addressForm)}
                  >
                    <SlotTimers
                      slots={(ready.template[templateDayOf(selected) - 1]?.slots ?? []).map(
                        (slot, index) => ({ ...slot, index }),
                      )}
                      initial={timer.state}
                      programDay={ready.today}
                    />
                  </NextIntlClientProvider>
                ) : undefined
              }
            />
            {commentable && comments ? (
              <NextIntlClientProvider
                locale={locale}
                messages={studentMessages(locale, addressForm)}
              >
                <DayComment
                  key={selectedCell.date}
                  date={selectedCell.date}
                  initialText={comments.get(selectedCell.date) ?? ''}
                />
              </NextIntlClientProvider>
            ) : null}
          </section>

          <section className={styles.section} aria-labelledby="grid-title">
            <h2 id="grid-title" className={styles.today}>
              {tw('week', { week: weekOf(ready.today) })}
            </h2>
            <p className={styles.lead}>{tt('gridHint')}</p>
            <DayGrid
              cells={grid}
              week={weekOf(ready.today)}
              selected={selected}
              locale={locale}
              addressForm={addressForm}
            />
          </section>
        </>
      ) : null}

      {ready ? (
        <div className={styles.section}>
          <Link href="/study/weeks" className={styles.back}>
            {tw('title')}
          </Link>
        </div>
      ) : null}

      <div className={styles.actions}>
        <Link href="/study/settings" className={styles.logout}>
          {t('settingsLink')}
        </Link>
        <form action={logoutAction}>
          <button type="submit" className={styles.logout}>
            {t('logout')}
          </button>
        </form>
      </div>
    </div>
  )
}
