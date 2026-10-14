import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { weekDates } from './shape'

export type CellView = { text: string; done: boolean }
export type PlannerView = {
  plannerId: number
  studentId: number
  baseDate: string
  weeks: { id: number; index: number }[]
  active: { id: number; index: number; rowCount: number; dates: string[] } & {
    cells: Record<string, CellView> // key `${row}-${day}`
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
  return {
    plannerId: planner.id,
    studentId,
    baseDate: planner.baseDate,
    weeks: weeks.map((w) => ({ id: w.id, index: w.index })),
    active: {
      id: week.id,
      index: week.index,
      rowCount: week.rowCount,
      dates: weekDates(planner.baseDate, week.index),
      cells: Object.fromEntries(
        docs.map((c) => [`${c.row}-${c.day}`, { text: c.text ?? '', done: Boolean(c.done) }]),
      ),
    },
  }
}
