// Progress maths of the weekly planner (story 024). Pure: no framework, no database.
// Every percent is done / written tasks, never done / grid cells, and groups are weighted by tasks.

import { addDays, diffDays, isAssignedTask, weekDates } from './shape'

export type TaskCell = { text: string | null | undefined; done: boolean | null | undefined }
export type Stats = { total: number; done: number }

export const GROUP_SIZE = 4

export function weekStats(cells: readonly TaskCell[]): Stats {
  let total = 0
  let done = 0
  for (const cell of cells) {
    if (!isAssignedTask(cell.text)) continue
    total += 1
    if (cell.done) done += 1
  }
  return { total, done }
}

/** Rounded percent, or null when there is nothing to measure (never a misleading 100%). */
export const percentOf = ({ total, done }: Stats): number | null =>
  total === 0 ? null : Math.round((done / total) * 100)

export type WeekTotals = Stats & { index: number }
export type Group = Stats & {
  /** Lowest and highest week index that exists in this group (0-based). */
  first: number
  last: number
  /** Monday of the first week and Sunday of the last week, `YYYY-MM-DD`. */
  start: string
  end: string
}

/** Weeks `0–3`, `4–7`… by index; a gap or a short last group is kept, not dropped or padded. */
export function fourWeekGroups(baseDate: string, weeks: readonly WeekTotals[]): Group[] {
  const byGroup = new Map<number, WeekTotals[]>()
  for (const week of weeks) {
    const key = Math.floor(week.index / GROUP_SIZE)
    byGroup.set(key, [...(byGroup.get(key) ?? []), week])
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, members]) => {
      const indexes = members.map((w) => w.index)
      const first = Math.min(...indexes)
      const last = Math.max(...indexes)
      return {
        first,
        last,
        start: weekDates(baseDate, first)[0]!,
        end: weekDates(baseDate, last)[6]!,
        total: members.reduce((sum, w) => sum + w.total, 0),
        done: members.reduce((sum, w) => sum + w.done, 0),
      }
    })
}

/** Calendar days from `today` to `deadline`: 0 is today, negative is overdue. */
export const daysLeft = (deadline: string, today: string): number => diffDays(today, deadline)

export type DatedTask = TaskCell & { date: string }
export type DeadlineStats = Stats & { daysLeft: number; state: 'left' | 'today' | 'overdue' }

/** Only written tasks dated on or before the deadline count. */
export function deadlineStats(
  tasks: readonly DatedTask[],
  deadline: string,
  today: string,
): DeadlineStats {
  const eligible = tasks.filter((task) => task.date <= deadline)
  const left = daysLeft(deadline, today)
  return {
    ...weekStats(eligible),
    daysLeft: left,
    state: left < 0 ? 'overdue' : left === 0 ? 'today' : 'left',
  }
}

/** Date of a cell (row-independent): the weekday column of week `index`. */
export const cellDate = (baseDate: string, index: number, day: number): string =>
  addDays(baseDate, index * 7 + day)
