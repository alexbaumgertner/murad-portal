'use client'

import { useLocale, useTranslations } from 'next-intl'

import type { OtherTask, ProgressSettings } from '@/features/planner/queries'
import {
  cellDate,
  deadlineStats,
  fourWeekGroups,
  percentOf,
  weekStats,
  type DatedTask,
  type Stats,
} from '@/features/planner/progress'

import styles from './PlannerProgress.module.css'

type Props = {
  baseDate: string
  /** Index of the week on screen and its live cells (so a tick moves the numbers at once). */
  activeIndex: number
  activeCells: { text: string; done: boolean; day: number }[]
  /** Every week that exists, with the written tasks of the weeks not on screen. */
  weekIndexes: number[]
  otherTasks: OtherTask[]
  settings: ProgressSettings
  today: string
  /** `strip`: the weekly percent for the header strip; `blocks`: four-week and deadline bars. */
  part: 'strip' | 'blocks'
}

const two = (n: number) => String(n + 1).padStart(2, '0')

function Bar({ stats, label }: { stats: Stats; label: string }) {
  const percent = percentOf(stats)
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
    >
      <div className={styles.fill} style={{ width: `${percent ?? 0}%` }} />
    </div>
  )
}

/**
 * The optional progress blocks (story 024): this week, every four weeks, the exam deadline.
 * Every number is done / written tasks; the groups are weighted by tasks, not averaged.
 */
export function PlannerProgress({
  baseDate,
  activeIndex,
  activeCells,
  weekIndexes,
  otherTasks,
  settings,
  today,
  part,
}: Props) {
  const t = useTranslations('Planner.progress')
  const locale = useLocale()
  const date = (iso: string, withYear = false) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    }).format(new Date(`${iso}T12:00:00Z`))

  const live = weekStats(activeCells)
  const perWeek = weekIndexes.map((index) =>
    index === activeIndex
      ? { index, ...live }
      : {
          index,
          ...weekStats(
            otherTasks
              .filter((task) => task.week === index)
              .map((task) => ({ text: 'x', done: task.done })),
          ),
        },
  )
  const weekPercent = percentOf(live)

  const activeTasks: DatedTask[] = activeCells.map((cell) => ({
    ...cell,
    date: cellDate(baseDate, activeIndex, cell.day),
  }))
  const deadline = settings.deadlineDate
    ? deadlineStats(
        [
          ...activeTasks,
          ...otherTasks.map((task) => ({
            text: 'x',
            done: task.done,
            date: cellDate(baseDate, task.week, task.day),
          })),
        ],
        settings.deadlineDate,
        today,
      )
    : null

  if (part === 'strip')
    return settings.showWeekProgress ? (
      <p className={styles.strip} role="status">
        <span>{t('week')}</span>{' '}
        <strong>{weekPercent === null ? t('noTasks') : `${weekPercent}%`}</strong>
      </p>
    ) : null

  return (
    <div className={styles.wrap}>
      {settings.showFourWeekProgress ? (
        <section aria-label={t('fourWeeks')} className={styles.block}>
          {fourWeekGroups(baseDate, perWeek).map((group) => {
            const percent = percentOf(group)
            const heading = t('weeksRange', { from: two(group.first), to: two(group.last) })
            return (
              <div key={group.first} className={styles.item}>
                <div className={styles.line}>
                  <strong>{heading}</strong>
                  <span className={styles.muted}>
                    {date(group.start)} – {date(group.end, true)}
                  </span>
                  <span className={styles.percent}>
                    {percent === null ? t('noTasks') : `${percent}%`}
                  </span>
                </div>
                <Bar stats={group} label={heading} />
              </div>
            )
          })}
        </section>
      ) : null}
      {settings.showDeadlineProgress && deadline && settings.deadlineDate ? (
        <section aria-label={t('deadline')} className={styles.block}>
          <div className={styles.line}>
            <strong>{settings.deadlineTitle || t('deadline')}</strong>
            <span className={styles.muted}>{date(settings.deadlineDate, true)}</span>
            <span className={styles.muted}>
              {deadline.state === 'overdue'
                ? t('overdue')
                : deadline.state === 'today'
                  ? t('today')
                  : t('daysLeft', { count: deadline.daysLeft })}
            </span>
            <span className={styles.percent}>
              {percentOf(deadline) === null ? t('noTasks') : `${percentOf(deadline)}%`}
            </span>
          </div>
          <Bar stats={deadline} label={settings.deadlineTitle || t('deadline')} />
        </section>
      ) : null}
    </div>
  )
}
