import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { isOwner } from '@/access'

import type {
  Labels,
  NoteInput,
  PlannerError,
  ProgressSettingsInput,
  SaveHeaderInput,
} from './schema'
import { MAX_ROWS, isAssignedTask, mondayOf } from './shape'

/**
 * Planner writes (story 022). Callers name ids; every call first reads the week AS the user
 * (`overrideAccess: false`), so a student can only reach her own planner and a stranger gets
 * `not_found`. Writes then use `overrideAccess: true` because the collections are owner-write.
 */

export type Result = { ok: true } | { ok: false; error: PlannerError }
const ok: Result = { ok: true }
const fail = (error: PlannerError): Result => ({ ok: false, error })

async function weekOf(payload: Payload, user: TypedUser, weekId: number) {
  return payload.findByID({
    collection: 'planner-weeks',
    id: weekId,
    depth: 0,
    overrideAccess: false,
    user,
    disableErrors: true,
  })
}

export async function createPlanner(
  payload: Payload,
  owner: TypedUser,
  input: { studentId: number; baseDate: string },
): Promise<Result> {
  if (!isOwner(owner)) return fail('forbidden')
  const student = await payload.findByID({
    collection: 'users',
    id: input.studentId,
    depth: 0,
    overrideAccess: true, // the owner picks any student
    disableErrors: true,
  })
  if (!student || student.role !== 'student') return fail('not_found')
  const existing = await payload.count({
    collection: 'planners',
    where: { student: { equals: input.studentId } },
    overrideAccess: true,
  })
  if (existing.totalDocs > 0) return fail('exists')
  const planner = await payload.create({
    collection: 'planners',
    data: { student: input.studentId, baseDate: mondayOf(input.baseDate) },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'planner-weeks',
    data: { planner: planner.id, index: 0, rowCount: 1 },
    overrideAccess: true,
  })
  return ok
}

/** A new week goes after the highest index (gaps stay) and always starts with one empty row. */
export async function addWeek(
  payload: Payload,
  owner: TypedUser,
  plannerId: number,
): Promise<Result> {
  if (!isOwner(owner)) return fail('forbidden')
  const planner = await payload.findByID({
    collection: 'planners',
    id: plannerId,
    depth: 0,
    disableErrors: true,
  })
  if (!planner) return fail('not_found')
  const last = await payload.find({
    collection: 'planner-weeks',
    where: { planner: { equals: plannerId } },
    sort: '-index',
    limit: 1,
    depth: 0,
    pagination: false,
  })
  await payload.create({
    collection: 'planner-weeks',
    data: { planner: plannerId, index: (last.docs[0]?.index ?? -1) + 1, rowCount: 1 },
    overrideAccess: true,
  })
  return ok
}

export async function deleteWeek(
  payload: Payload,
  owner: TypedUser,
  weekId: number,
): Promise<Result> {
  if (!isOwner(owner)) return fail('forbidden')
  const week = await weekOf(payload, owner, weekId)
  if (!week) return fail('not_found')
  await payload.delete({ collection: 'planner-weeks', id: weekId, overrideAccess: true })
  return ok
}

export async function addRow(payload: Payload, owner: TypedUser, weekId: number): Promise<Result> {
  if (!isOwner(owner)) return fail('forbidden')
  const week = await weekOf(payload, owner, weekId)
  if (!week) return fail('not_found')
  if (week.rowCount >= MAX_ROWS) return fail('max_rows')
  await payload.update({
    collection: 'planner-weeks',
    id: weekId,
    data: { rowCount: week.rowCount + 1 },
    overrideAccess: true,
  })
  return ok
}

/** Removes the last row of this week and the tasks and ticks in it. */
export async function removeRow(
  payload: Payload,
  owner: TypedUser,
  weekId: number,
): Promise<Result> {
  if (!isOwner(owner)) return fail('forbidden')
  const week = await weekOf(payload, owner, weekId)
  if (!week) return fail('not_found')
  if (week.rowCount <= 1) return fail('min_rows')
  await payload.delete({
    collection: 'planner-cells',
    where: { week: { equals: weekId }, row: { equals: week.rowCount - 1 } },
    overrideAccess: true,
  })
  await payload.update({
    collection: 'planner-weeks',
    id: weekId,
    data: { rowCount: week.rowCount - 1 },
    overrideAccess: true,
  })
  return ok
}

async function findCell(payload: Payload, weekId: number, row: number, day: number) {
  const { docs } = await payload.find({
    collection: 'planner-cells',
    where: { week: { equals: weekId }, row: { equals: row }, day: { equals: day } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0] ?? null
}

/** Owner types a task. A cleared task also clears its tick; an empty untouched cell is not stored. */
export async function setCellText(
  payload: Payload,
  owner: TypedUser,
  input: { weekId: number; row: number; day: number; text: string },
): Promise<Result> {
  if (!isOwner(owner)) return fail('forbidden')
  const week = await weekOf(payload, owner, input.weekId)
  if (!week) return fail('not_found')
  if (input.row >= week.rowCount) return fail('invalid_input')
  const cell = await findCell(payload, input.weekId, input.row, input.day)
  const assigned = isAssignedTask(input.text)
  const text = input.text.trim()
  if (!assigned && !text) {
    if (cell)
      await payload.delete({ collection: 'planner-cells', id: cell.id, overrideAccess: true })
    return ok
  }
  const data = { text: input.text, done: assigned ? Boolean(cell?.done) : false }
  if (cell)
    await payload.update({ collection: 'planner-cells', id: cell.id, data, overrideAccess: true })
  else
    await payload.create({
      collection: 'planner-cells',
      data: { week: input.weekId, row: input.row, day: input.day, ...data },
      overrideAccess: true,
    })
  return ok
}

/** The owner or the student of this planner sets the tick. Absolute value, so the last click wins. */
export async function setDone(
  payload: Payload,
  user: TypedUser,
  input: { weekId: number; row: number; day: number; done: boolean },
): Promise<Result> {
  const week = await weekOf(payload, user, input.weekId)
  if (!week) return fail('not_found')
  const cell = await findCell(payload, input.weekId, input.row, input.day)
  if (!cell || !isAssignedTask(cell.text)) return fail('empty_task')
  await payload.update({
    collection: 'planner-cells',
    id: cell.id,
    data: { done: input.done },
    overrideAccess: true,
  })
  return ok
}

/** Owner switches the progress blocks and sets the exam deadline. */
export async function saveProgressSettings(
  payload: Payload,
  owner: TypedUser,
  input: ProgressSettingsInput,
): Promise<Result> {
  if (!isOwner(owner)) return fail('forbidden')
  const { plannerId, deadlineDate, ...rest } = input
  const planner = await payload.findByID({
    collection: 'planners',
    id: plannerId,
    depth: 0,
    disableErrors: true,
  })
  if (!planner) return fail('not_found')
  await payload.update({
    collection: 'planners',
    id: plannerId,
    data: { ...rest, deadlineDate: deadlineDate || null },
    overrideAccess: true,
  })
  return ok
}

/** Owner edits the header and printed words. Empty label strings drop the override. */
export async function saveHeader(
  payload: Payload,
  owner: TypedUser,
  input: SaveHeaderInput,
): Promise<Result> {
  if (!isOwner(owner)) return fail('forbidden')
  const { plannerId, labels, ...texts } = input
  const planner = await payload.findByID({
    collection: 'planners',
    id: plannerId,
    depth: 0,
    disableErrors: true,
  })
  if (!planner) return fail('not_found')
  const data: Record<string, unknown> = { ...texts }
  if (labels) {
    const merged: Record<string, unknown> = {
      ...((planner.labels as Labels | null) ?? {}),
      ...labels,
    }
    for (const [key, value] of Object.entries(merged)) {
      const blank = Array.isArray(value) ? value.every((item) => item === '') : value === ''
      if (blank) delete merged[key]
    }
    data.labels = merged
  }
  await payload.update({ collection: 'planners', id: plannerId, data, overrideAccess: true })
  return ok
}

/** The owner or the student of this planner writes a diary entry; empty text deletes it. */
export async function saveNote(
  payload: Payload,
  user: TypedUser,
  input: NoteInput,
): Promise<Result> {
  const week = await weekOf(payload, user, input.weekId)
  if (!week) return fail('not_found')
  const { docs } = await payload.find({
    collection: 'planner-notes',
    where: {
      week: { equals: input.weekId },
      kind: { equals: input.kind },
      day: { equals: input.day },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const note = docs[0]
  if (input.text.trim() === '') {
    if (note)
      await payload.delete({ collection: 'planner-notes', id: note.id, overrideAccess: true })
    return ok
  }
  if (note)
    await payload.update({
      collection: 'planner-notes',
      id: note.id,
      data: { text: input.text },
      overrideAccess: true,
    })
  else
    await payload.create({
      collection: 'planner-notes',
      data: { week: input.weekId, kind: input.kind, day: input.day, text: input.text },
      overrideAccess: true,
    })
  return ok
}
