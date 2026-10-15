import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { isOwner } from '@/access'
import { diffDays } from '@/features/planner/shape'

import {
  IDLE_DAYS,
  sortRows,
  summarizePlanner,
  type DashboardRow,
  type PlannerFacts,
  type WeekFacts,
} from './dashboard-shape'
import { listProgramSummariesByStudent } from './queries'

/** How many weeks back (current included) the «last tick» looks: keeps the read small. */
const TICK_WINDOW_WEEKS = 5

const asId = (value: number | { id: number }): number =>
  typeof value === 'object' ? value.id : value

/**
 * Story 030: one row per student with the state of her planner and her program. A fixed number of
 * reads whatever the number of students; every read is made as the owner with
 * `overrideAccess: false`, and only the fields the page shows are selected (no placement, no
 * appearance JSON). Read-only.
 */
export async function listStudentDashboard(
  payload: Payload,
  user: TypedUser,
  locale: 'ru' | 'en',
  now: Date = new Date(),
): Promise<DashboardRow[]> {
  if (!isOwner(user)) throw new Error('forbidden')
  const today = now.toISOString().slice(0, 10)
  const read = { pagination: false, depth: 0, overrideAccess: false, user } as const

  const [students, planners, programs] = await Promise.all([
    payload.find({
      collection: 'users',
      where: { role: { equals: 'student' } },
      select: { name: true, email: true },
      ...read,
    }),
    payload.find({
      collection: 'planners',
      select: { student: true, baseDate: true },
      ...read,
    }),
    listProgramSummariesByStudent(payload, user, locale, now),
  ])

  const plannerIds = planners.docs.map((planner) => planner.id)
  const weeks = plannerIds.length
    ? await payload.find({
        collection: 'planner-weeks',
        where: { planner: { in: plannerIds } },
        select: { planner: true, index: true },
        ...read,
      })
    : { docs: [] }

  const baseOf = new Map(planners.docs.map((planner) => [planner.id, planner.baseDate]))
  const weekIdsOfPlanner = new Map<number, { id: number; index: number }[]>()
  for (const week of weeks.docs) {
    const plannerId = asId(week.planner)
    weekIdsOfPlanner.set(plannerId, [
      ...(weekIdsOfPlanner.get(plannerId) ?? []),
      { id: week.id, index: week.index },
    ])
  }

  // The week of today in each planner, and the few weeks before it for the «last tick».
  const currentIds: number[] = []
  const windowIds: number[] = []
  const currentIndex = new Map<number, number>()
  for (const [plannerId, list] of weekIdsOfPlanner) {
    const index = Math.floor(diffDays(baseOf.get(plannerId)!, today) / 7)
    currentIndex.set(plannerId, index)
    for (const week of list) {
      if (week.index === index) currentIds.push(week.id)
      if (week.index <= index && week.index > index - TICK_WINDOW_WEEKS) windowIds.push(week.id)
    }
  }

  const [cells, notes, ticks] = await Promise.all([
    currentIds.length
      ? payload.find({
          collection: 'planner-cells',
          where: { week: { in: currentIds } },
          select: { week: true, day: true, text: true, done: true },
          ...read,
        })
      : { docs: [] },
    currentIds.length
      ? payload.find({
          collection: 'planner-notes',
          where: { week: { in: currentIds }, kind: { equals: 'questions' } },
          select: { week: true, text: true },
          ...read,
        })
      : { docs: [] },
    windowIds.length
      ? payload.find({
          collection: 'planner-cells',
          where: { week: { in: windowIds }, done: { equals: true } },
          sort: '-updatedAt',
          select: { week: true, updatedAt: true },
          ...read,
        })
      : { docs: [] },
  ])

  const plannerOfWeek = new Map<number, number>()
  for (const [plannerId, list] of weekIdsOfPlanner)
    for (const week of list) plannerOfWeek.set(week.id, plannerId)

  const lastTickOf = new Map<number, string>()
  for (const tick of ticks.docs) {
    const plannerId = plannerOfWeek.get(asId(tick.week))
    // Sorted newest first: the first tick of a planner is its latest.
    if (plannerId !== undefined && !lastTickOf.has(plannerId))
      lastTickOf.set(plannerId, tick.updatedAt)
  }

  const factsOf = new Map<number, PlannerFacts>()
  for (const planner of planners.docs) {
    const list = weekIdsOfPlanner.get(planner.id) ?? []
    const weekFacts: WeekFacts[] = list
      .filter((week) => week.index === currentIndex.get(planner.id))
      .map((week) => ({
        index: week.index,
        cells: cells.docs
          .filter((cell) => asId(cell.week) === week.id)
          .map(({ day, text, done }) => ({ day, text, done })),
        questionNotes: notes.docs.filter(
          (note) => asId(note.week) === week.id && note.text.trim() !== '',
        ).length,
      }))
    factsOf.set(asId(planner.student), {
      baseDate: planner.baseDate,
      weeks: weekFacts,
      lastTickAt: lastTickOf.get(planner.id) ?? null,
    })
  }
  const plannerIdOfStudent = new Map(planners.docs.map((p) => [asId(p.student), p.id]))

  const rows = students.docs.map((student): DashboardRow => {
    const program = programs.get(student.id) ?? null
    const summary = summarizePlanner(factsOf.get(student.id) ?? null, today, IDLE_DAYS)
    return {
      ...summary,
      studentId: student.id,
      plannerId: plannerIdOfStudent.get(student.id) ?? null,
      name: student.name?.trim() || student.email,
      active: summary.hasPlanner || program?.status === 'active',
      program,
    }
  })
  return sortRows(rows, locale)
}
