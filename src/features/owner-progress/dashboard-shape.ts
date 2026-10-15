// Pure rules of the owner's dashboard (story 030): where a student stands in her planner, the
// "needs help" signals, filters and ordering. No framework imports.

import { diffDays, weekDates } from '@/features/planner/shape'
import { percentOf, weekStats, type Stats } from '@/features/planner/progress'

import type { StudentSummary } from './shape'

/** No tick for this many days while tasks are due means the student is stuck. */
export const IDLE_DAYS = 3

export const FILTERS = ['all', 'help', 'noPlanner', 'active'] as const
export type DashboardFilter = (typeof FILTERS)[number]

export type Signal = 'noPlanner' | 'noTasks' | 'idle' | 'questions'

export type WeekFacts = {
  /** 0-based index counted from the planner's base Monday. */
  index: number
  cells: { day: number; text: string | null | undefined; done: boolean | null | undefined }[]
  /** Non-empty «Questions» diary notes of this week. */
  questionNotes: number
}

export type PlannerFacts = {
  baseDate: string
  weeks: WeekFacts[]
  /** ISO timestamp of the newest ticked cell the query looked at, or `null`. */
  lastTickAt: string | null
}

export type PlannerSummary = {
  hasPlanner: boolean
  /** 1-based number of the week that contains today, or `null`. */
  currentWeek: number | null
  weekStart: string | null
  stats: Stats | null
  percent: number | null
  /** `YYYY-MM-DD` of the newest tick, or `null`. */
  lastTick: string | null
  signals: Signal[]
  needsHelp: boolean
}

export type DashboardRow = PlannerSummary & {
  studentId: number
  plannerId: number | null
  name: string
  active: boolean
  program: StudentSummary | null
}

export function parseFilter(value: unknown): DashboardFilter {
  return FILTERS.find((filter) => filter === value) ?? 'all'
}

export function summarizePlanner(
  planner: PlannerFacts | null,
  today: string,
  idleDays: number = IDLE_DAYS,
): PlannerSummary {
  if (!planner) {
    return {
      hasPlanner: false,
      currentWeek: null,
      weekStart: null,
      stats: null,
      percent: null,
      lastTick: null,
      signals: ['noPlanner'],
      needsHelp: false,
    }
  }

  const index = Math.floor(diffDays(planner.baseDate, today) / 7)
  const week = index >= 0 ? planner.weeks.find((w) => w.index === index) : undefined
  const lastTick = planner.lastTickAt ? planner.lastTickAt.slice(0, 10) : null
  const signals: Signal[] = []
  let stats: Stats | null = null

  if (!week) {
    signals.push('noTasks')
  } else {
    stats = weekStats(week.cells)
    if (stats.total === 0) signals.push('noTasks')
    else {
      const dates = weekDates(planner.baseDate, index)
      const due = weekStats(week.cells.filter((cell) => dates[cell.day]! <= today)).total
      if (due > 0 && (lastTick === null || diffDays(lastTick, today) >= idleDays)) {
        signals.push('idle')
      }
    }
    if (week.questionNotes > 0) signals.push('questions')
  }

  return {
    hasPlanner: true,
    currentWeek: week ? index + 1 : null,
    weekStart: week ? weekDates(planner.baseDate, index)[0]! : null,
    stats,
    percent: stats ? percentOf(stats) : null,
    lastTick,
    signals,
    needsHelp: signals.length > 0,
  }
}

export function applyFilter(rows: DashboardRow[], filter: DashboardFilter): DashboardRow[] {
  switch (filter) {
    case 'help':
      return rows.filter((row) => row.needsHelp)
    case 'noPlanner':
      return rows.filter((row) => !row.hasPlanner)
    case 'active':
      return rows.filter((row) => row.active)
    default:
      return rows
  }
}

const group = (row: DashboardRow) => (row.needsHelp ? 0 : row.hasPlanner ? 1 : 2)

/** Needs help first, then a planner, then none; oldest tick first (never ticked is oldest). */
export function sortRows(rows: DashboardRow[], locale: string): DashboardRow[] {
  return [...rows].sort(
    (a, b) =>
      group(a) - group(b) ||
      (a.lastTick ?? '').localeCompare(b.lastTick ?? '') ||
      a.name.localeCompare(b.name, locale),
  )
}
