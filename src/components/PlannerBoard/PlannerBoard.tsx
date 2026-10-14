'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { PlannerDiary } from '@/components/PlannerDiary/PlannerDiary'
import { PlannerGrid } from '@/components/PlannerGrid/PlannerGrid'
import { PlannerHeader } from '@/components/PlannerHeader/PlannerHeader'
import { useOptionalPlanner } from '@/components/PlannerShell/planner-context'
import { PlannerProgress } from '@/components/PlannerProgress/PlannerProgress'
import { saveHeaderAction } from '@/features/planner/actions'
import type { CellView, HeaderView, OtherTask, ProgressSettings } from '@/features/planner/queries'

import styles from './PlannerBoard.module.css'

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

type Props = {
  plannerId: number
  weekId: number
  weekIndex: number
  rowCount: number
  dates: string[]
  cells: Record<string, CellView>
  taskTypes?: string[]
  notes: Record<string, string>
  /** True for the owner: edits everything. A student ticks and writes her diary only. */
  canEdit: boolean
  baseDate: string
  weekIndexes: number[]
  otherTasks: OtherTask[]
  header: HeaderView
  settings: ProgressSettings
  today: string
}

/** One printable sheet: header, grid, diary and progress share the live cells. */
export function PlannerBoard({
  plannerId,
  weekIndex,
  baseDate,
  weekIndexes,
  otherTasks,
  header,
  settings,
  today,
  notes,
  ...grid
}: Props) {
  const t = useTranslations('Planner')
  const shell = useOptionalPlanner()
  const [live, setLive] = useState(grid.cells)
  const activeCells = Object.entries(live).map(([key, cell]) => ({
    ...cell,
    day: Number(key.split('-')[1]),
  }))
  const dayNames = DAY_KEYS.map((key, day) => header.labels.days?.[day] || t(`days.${key}`))
  const progress = {
    baseDate,
    activeIndex: weekIndex,
    activeCells,
    weekIndexes,
    otherTasks,
    settings,
    today,
  }

  return (
    <article className={styles.sheet}>
      <PlannerHeader
        plannerId={plannerId}
        header={header}
        weekIndex={weekIndex}
        monday={grid.dates[0]!}
        canEdit={grid.canEdit}
        progress={<PlannerProgress {...progress} part="strip" />}
        tools={
          <>
            <button
              type="button"
              className={styles.tool}
              aria-label={t('print')}
              title={t('print')}
              onClick={() => window.print()}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 9V3h10v6" />
                <rect x="3" y="9" width="18" height="8" rx="2" />
                <path d="M7 14h10v7H7z" />
              </svg>
            </button>
            {shell ? (
              <button
                type="button"
                className={styles.tool}
                aria-label={t('settings.open')}
                onClick={shell.openSettings}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                </svg>
              </button>
            ) : null}
          </>
        }
      />
      <div className={styles.body}>
        <PlannerGrid
          {...grid}
          dayNames={dayNames}
          onDayName={(day, value) => {
            const days = Array.from({ length: 7 }, (_, i) => header.labels.days?.[i] ?? '')
            days[day] = value
            return saveHeaderAction({ plannerId, labels: { days } }).then(
              (result) => result.status === 'success',
            )
          }}
          onCellsChange={setLive}
        />
        <PlannerDiary
          plannerId={plannerId}
          weekId={grid.weekId}
          labels={header.labels}
          notes={notes}
          isOwner={grid.canEdit}
        />
        <PlannerProgress {...progress} part="blocks" />
      </div>
    </article>
  )
}
