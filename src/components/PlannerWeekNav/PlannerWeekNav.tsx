'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'

import { Link } from '@/i18n/navigation'

import styles from './PlannerWeekNav.module.css'

export type WeekNavItem = { id: number; index: number; label: string; from: string; to: string }

type Props = {
  weeks: WeekNavItem[]
  activeId: number
  /** The owner opens a student's planner with `?student=`; a student has no such parameter. */
  studentId?: number
}

/** Week pills with their dates, previous/next arrows, and the current week scrolled into view. */
export function PlannerWeekNav({ weeks, activeId, studentId }: Props) {
  const t = useTranslations('Planner')
  const locale = useLocale()
  const activeRef = useRef<HTMLAnchorElement>(null)
  const position = weeks.findIndex((week) => week.id === activeId)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [activeId])

  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(`${iso}T12:00:00Z`),
    )
  const href = (week: WeekNavItem) => ({
    pathname: '/study/planner' as const,
    query: studentId ? { student: studentId, week: week.index } : { week: week.index },
  })
  const prev = weeks[position - 1]
  const next = weeks[position + 1]

  const arrow = (target: WeekNavItem | undefined, label: string, glyph: string) =>
    target ? (
      <Link href={href(target)} className={styles.arrow} aria-label={label} title={label}>
        {glyph}
      </Link>
    ) : (
      <span className={styles.arrowOff} aria-hidden="true">
        {glyph}
      </span>
    )

  return (
    <nav aria-label={t('weeksNav')} className={styles.nav}>
      {arrow(prev, t('prevWeek'), '‹')}
      <ol className={styles.weeks}>
        {weeks.map((week) => (
          <li key={week.id}>
            <Link
              ref={week.id === activeId ? activeRef : undefined}
              href={href(week)}
              className={styles.week}
              aria-current={week.id === activeId ? 'page' : undefined}
            >
              <span className={styles.name}>{week.label}</span>
              <span className={styles.range}>
                {day(week.from)} — {day(week.to)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {arrow(next, t('nextWeek'), '›')}
    </nav>
  )
}
