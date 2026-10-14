import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { DEFAULT_TIMEZONE, todayIn } from '@/features/enrollments/shape'

import { parseAppearance, type Appearance } from './appearance'
import type { Labels } from './schema'
import { isAssignedTask, readTaskTypes, weekDates } from './shape'

export type CellView = { text: string; done: boolean }
export type ProgressSettings = {
  showWeekProgress: boolean
  showFourWeekProgress: boolean
  showDeadlineProgress: boolean
  deadlineTitle: string
  /** `YYYY-MM-DD` or empty. */
  deadlineDate: string
}
/** A written task of a week the grid is not showing: enough to count it, never its text. */
export type OtherTask = { week: number; day: number; done: boolean }

export type HeaderView = {
  studentName: string
  goal: string
  subtitle: string
  labels: Labels
}

export type PlannerView = {
  plannerId: number
  studentId: number
  baseDate: string
  weeks: { id: number; index: number }[]
  header: HeaderView
  appearance: Appearance
  taskTypes: string[]
  settings: ProgressSettings
  today: string
  otherTasks: OtherTask[]
  active: { id: number; index: number; rowCount: number; dates: string[] } & {
    cells: Record<string, CellView> // key `${row}-${day}`
    notes: Record<string, string> // key `${kind}-${day}`
  }
}

/**
 * The planner of `studentId` as `user` sees it (`overrideAccess: false`: a student gets only her
 * own, anyone else gets null). `weekIndex` picks the week; unknown or missing → the first one.
 */
export async function getPlannerView(
  payload: Payload,
  user: TypedUser,
  studentId: number,
  weekIndex?: number,
): Promise<PlannerView | null> {
  const found = await payload.find({
    collection: 'planners',
    where: { student: { equals: studentId } },
    limit: 1,
    depth: 0,
    overrideAccess: false,
    user,
  })
  const planner = found.docs[0]
  if (!planner) return null
  const { docs: weeks } = await payload.find({
    collection: 'planner-weeks',
    where: { planner: { equals: planner.id } },
    sort: 'index',
    pagination: false,
    depth: 0,
    overrideAccess: false,
    user,
  })
  const week = weeks.find((w) => w.index === weekIndex) ?? weeks[0]
  if (!week) return null
  const { docs } = await payload.find({
    collection: 'planner-cells',
    where: { week: { equals: week.id } },
    pagination: false,
    depth: 0,
    overrideAccess: false,
    user,
  })
  const noteDocs = (
    await payload.find({
      collection: 'planner-notes',
      where: { week: { equals: week.id } },
      pagination: false,
      depth: 0,
      overrideAccess: false,
      user,
    })
  ).docs
  const others = weeks.filter((w) => w.id !== week.id)
  const otherCells = others.length
    ? (
        await payload.find({
          collection: 'planner-cells',
          where: { week: { in: others.map((w) => w.id) } },
          pagination: false,
          depth: 0,
          select: { week: true, day: true, text: true, done: true },
          overrideAccess: false,
          user,
        })
      ).docs
    : []
  const indexOf = new Map(weeks.map((w) => [w.id, w.index]))
  const idOf = (rel: number | { id: number }) => (typeof rel === 'object' ? rel.id : rel)
  return {
    plannerId: planner.id,
    header: {
      studentName: planner.studentName ?? '',
      goal: planner.goal ?? '',
      subtitle: planner.subtitle ?? '',
      labels: (planner.labels as Labels | null) ?? {},
    },
    appearance: parseAppearance(planner.appearance),
    taskTypes: readTaskTypes(planner.taskTypes),
    settings: {
      showWeekProgress: planner.showWeekProgress ?? true,
      showFourWeekProgress: Boolean(planner.showFourWeekProgress),
      showDeadlineProgress: Boolean(planner.showDeadlineProgress),
      deadlineTitle: planner.deadlineTitle ?? '',
      deadlineDate: planner.deadlineDate ?? '',
    },
    today: todayIn(DEFAULT_TIMEZONE),
    otherTasks: otherCells
      .filter((c) => isAssignedTask(c.text))
      .map((c) => ({ week: indexOf.get(idOf(c.week))!, day: c.day, done: Boolean(c.done) })),
    studentId,
    baseDate: planner.baseDate,
    weeks: weeks.map((w) => ({ id: w.id, index: w.index })),
    active: {
      id: week.id,
      index: week.index,
      rowCount: week.rowCount,
      dates: weekDates(planner.baseDate, week.index),
      notes: Object.fromEntries(noteDocs.map((n) => [`${n.kind}-${n.day}`, n.text])),
      cells: Object.fromEntries(
        docs.map((c) => [`${c.row}-${c.day}`, { text: c.text ?? '', done: Boolean(c.done) }]),
      ),
    },
  }
}
