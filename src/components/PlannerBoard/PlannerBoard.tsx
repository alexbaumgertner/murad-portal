'use client'

import { useState } from 'react'

import { PlannerGrid } from '@/components/PlannerGrid/PlannerGrid'
import { PlannerProgress } from '@/components/PlannerProgress/PlannerProgress'
import type { CellView, OtherTask, ProgressSettings } from '@/features/planner/queries'

type Props = {
  weekId: number
  weekIndex: number
  rowCount: number
  dates: string[]
  cells: Record<string, CellView>
  canEdit: boolean
  baseDate: string
  weekIndexes: number[]
  otherTasks: OtherTask[]
  settings: ProgressSettings
  today: string
}

/** The grid and the progress under it share the live cells, so a tick moves the numbers at once. */
export function PlannerBoard({
  weekIndex,
  baseDate,
  weekIndexes,
  otherTasks,
  settings,
  today,
  ...grid
}: Props) {
  const [live, setLive] = useState(grid.cells)
  const activeCells = Object.entries(live).map(([key, cell]) => ({
    ...cell,
    day: Number(key.split('-')[1]),
  }))
  return (
    <>
      <PlannerGrid {...grid} onCellsChange={setLive} />
      <PlannerProgress
        baseDate={baseDate}
        activeIndex={weekIndex}
        activeCells={activeCells}
        weekIndexes={weekIndexes}
        otherTasks={otherTasks}
        settings={settings}
        today={today}
      />
    </>
  )
}
