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
            <button type="button" className={styles.tool} onClick={() => window.print()}>
              {t('print')}
            </button>
            {shell ? (
              <button
                type="button"
                className={styles.tool}
                aria-label={t('settings.open')}
                onClick={shell.openSettings}
              >
                ⚙
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
