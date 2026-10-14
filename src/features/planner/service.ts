import 'server-only'

import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
  type TypedUser,
  type Where,
} from 'payload'

import { isOwner } from '@/access'

import type {
  Labels,
  NoteInput,
  PlannerError,
  ProgressSettingsInput,
  SaveHeaderInput,
} from './schema'
import { parseAppearance } from './appearance'
import { blankSettings, blankWeek, buildBackup, type Backup, type PlannerData } from './backup'
import { MAX_ROWS, effectiveTaskTypes, isAssignedTask, mondayOf, readTaskTypes } from './shape'

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

/** The owner or the student of this planner adds a priority row (the week is read as the user). */
export async function addRow(payload: Payload, user: TypedUser, weekId: number): Promise<Result> {
  const week = await weekOf(payload, user, weekId)
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

/** Owner or student removes the last row of this week and the tasks and ticks in it. */
export async function removeRow(
  payload: Payload,
  user: TypedUser,
  weekId: number,
): Promise<Result> {
  const week = await weekOf(payload, user, weekId)
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
  user: TypedUser,
  input: { weekId: number; row: number; day: number; text: string },
): Promise<Result> {
  const week = await weekOf(payload, user, input.weekId)
  if (!week) return fail('not_found')
  if (input.row >= week.rowCount) return fail('invalid_input')
  // The owner types anything; a student only picks one of the owner's task types (or clears it).
  if (!isOwner(user) && input.text.trim() !== '') {
    const planner = await payload.findByID({
      collection: 'planners',
      id: typeof week.planner === 'object' ? week.planner.id : week.planner,
      depth: 0,
      overrideAccess: false,
      user,
      disableErrors: true,
    })
    if (!planner) return fail('not_found')
    const { docs } = await payload.find({
      collection: 'planner-cells',
      where: { 'week.planner': { equals: planner.id } },
      pagination: false,
      depth: 0,
      select: { text: true },
      overrideAccess: true,
    })
    const allowed = effectiveTaskTypes(
      readTaskTypes(planner.taskTypes),
      docs.map((cell) => cell.text ?? ''),
    )
    if (!allowed.includes(input.text.trim())) return fail('forbidden')
  }
  const cell = await findCell(payload, input.weekId, input.row, input.day)
  const typed = isOwner(user) ? input.text : input.text.trim()
  const assigned = isAssignedTask(typed)
  const text = typed.trim()
  if (!assigned && !text) {
    if (cell)
      await payload.delete({ collection: 'planner-cells', id: cell.id, overrideAccess: true })
    return ok
  }
  const data = { text: typed, done: assigned ? Boolean(cell?.done) : false }
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

/** Owner saves the list of task types a student picks from: trimmed, no blanks, no repeats. */
export async function saveTaskTypes(
  payload: Payload,
  owner: TypedUser,
  input: { plannerId: number; types: string[] },
): Promise<Result> {
  if (!isOwner(owner)) return fail('forbidden')
  const planner = await payload.findByID({
    collection: 'planners',
    id: input.plannerId,
    depth: 0,
    disableErrors: true,
  })
  if (!planner) return fail('not_found')
  const types = [...new Set(input.types.map((type) => type.trim()).filter(Boolean))]
  await payload.update({
    collection: 'planners',
    id: input.plannerId,
    data: { taskTypes: types },
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

/** The owner or the student of this planner saves how it looks. Anything invalid becomes default. */
export async function saveAppearance(
  payload: Payload,
  user: TypedUser,
  input: { plannerId: number; appearance: unknown },
): Promise<Result> {
  const planner = await payload.findByID({
    collection: 'planners',
    id: input.plannerId,
    depth: 0,
    overrideAccess: false,
    user,
    disableErrors: true,
  })
  if (!planner) return fail('not_found')
  await payload.update({
    collection: 'planners',
    id: input.plannerId,
    data: { appearance: parseAppearance(input.appearance) },
    overrideAccess: true,
  })
  return ok
}

// ---- backup, import, reset (story 028) ----

export type ExportResult =
  { ok: true; backup: Backup; studentName: string } | { ok: false; error: PlannerError }

/** The planner as `user` may read it (the student exports her own). */
export async function exportPlanner(
  payload: Payload,
  user: TypedUser,
  plannerId: number,
): Promise<ExportResult> {
  const planner = await payload.findByID({
    collection: 'planners',
    id: plannerId,
    depth: 0,
    overrideAccess: false,
    user,
    disableErrors: true,
  })
  if (!planner) return { ok: false, error: 'not_found' }
  const find = <C extends 'planner-weeks' | 'planner-cells' | 'planner-notes'>(
    collection: C,
    where: Where,
  ) =>
    payload.find({
      collection,
      where,
      pagination: false,
      depth: 0,
      sort: 'createdAt',
      overrideAccess: false,
      user,
    })
  const weeks = (await find('planner-weeks', { planner: { equals: plannerId } })).docs
  const ids = weeks.map((w) => w.id)
  const [cells, notes] = ids.length
    ? await Promise.all([
        find('planner-cells', { week: { in: ids } }),
        find('planner-notes', { week: { in: ids } }),
      ])
    : [{ docs: [] }, { docs: [] }]
  const weekOf = (rel: number | { id: number }) => (typeof rel === 'object' ? rel.id : rel)
  const data: PlannerData = {
    baseDate: planner.baseDate,
    studentName: planner.studentName ?? '',
    goal: planner.goal ?? '',
    subtitle: planner.subtitle ?? '',
    labels: (planner.labels as PlannerData['labels'] | null) ?? {},
    taskTypes: readTaskTypes(planner.taskTypes),
    settings: {
      showWeekProgress: planner.showWeekProgress ?? true,
      showFourWeekProgress: Boolean(planner.showFourWeekProgress),
      showDeadlineProgress: Boolean(planner.showDeadlineProgress),
      deadlineTitle: planner.deadlineTitle ?? '',
      deadlineDate: planner.deadlineDate ?? '',
    },
    appearance: parseAppearance(planner.appearance),
    weeks: weeks
      .map((week) => ({
        index: week.index,
        rowCount: week.rowCount,
        cells: cells.docs
          .filter((c) => weekOf(c.week) === week.id)
          .map((c) => ({ row: c.row, day: c.day, text: c.text ?? '', done: Boolean(c.done) })),
        notes: notes.docs
          .filter((n) => weekOf(n.week) === week.id)
          .map((n) => ({ kind: n.kind, day: n.day, text: n.text })),
      }))
      .sort((a, b) => a.index - b.index),
  }
  const student = await payload.findByID({
    collection: 'users',
    id: typeof planner.student === 'object' ? planner.student.id : planner.student,
    depth: 0,
    overrideAccess: false, // the owner reads any student, a student only herself
    user,
    disableErrors: true,
  })
  return { ok: true, backup: buildBackup(data), studentName: student?.name ?? '' }
}

/** Replaces everything of a planner with `data` in ONE transaction; any failure changes nothing. */
async function replaceContent(
  payload: Payload,
  plannerId: number,
  data: PlannerData,
): Promise<void> {
  const req: Partial<PayloadRequest> = await createLocalReq({}, payload)
  const started = await initTransaction(req as PayloadRequest)
  try {
    await payload.delete({
      collection: 'planner-weeks',
      where: { planner: { equals: plannerId } },
      overrideAccess: true,
      req: req as PayloadRequest,
    })
    await payload.update({
      collection: 'planners',
      id: plannerId,
      data: {
        baseDate: data.baseDate,
        studentName: data.studentName,
        goal: data.goal,
        subtitle: data.subtitle,
        labels: Object.keys(data.labels).length ? data.labels : null,
        taskTypes: data.taskTypes,
        appearance: data.appearance,
        ...data.settings,
        deadlineDate: data.settings.deadlineDate || null,
      },
      overrideAccess: true,
      req: req as PayloadRequest,
    })
    for (const week of data.weeks) {
      const created = await payload.create({
        collection: 'planner-weeks',
        data: { planner: plannerId, index: week.index, rowCount: week.rowCount },
        overrideAccess: true,
        req: req as PayloadRequest,
      })
      for (const cell of week.cells)
        await payload.create({
          collection: 'planner-cells',
          data: { week: created.id, ...cell },
          overrideAccess: true,
          req: req as PayloadRequest,
        })
      for (const note of week.notes)
        await payload.create({
          collection: 'planner-notes',
          data: { week: created.id, ...note },
          overrideAccess: true,
          req: req as PayloadRequest,
        })
    }
    if (started) await commitTransaction(req as PayloadRequest)
  } catch (error) {
    if (started) await killTransaction(req as PayloadRequest)
    throw error
  }
}

export async function importPlanner(
  payload: Payload,
  owner: TypedUser,
  plannerId: number,
  data: PlannerData,
): Promise<Result> {
  if (!isOwner(owner)) return fail('forbidden')
  const planner = await payload.findByID({
    collection: 'planners',
    id: plannerId,
    depth: 0,
    disableErrors: true,
  })
  if (!planner) return fail('not_found')
  await replaceContent(payload, plannerId, data)
  return ok
}

/** Back to the blank planner: no name or goal, one empty week, default look. The start date stays. */
export async function resetPlanner(
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
  await replaceContent(payload, plannerId, {
    baseDate: planner.baseDate,
    studentName: '',
    goal: '',
    subtitle: '',
    labels: {},
    taskTypes: [],
    settings: blankSettings(),
    appearance: parseAppearance(null),
    weeks: [blankWeek(0)],
  })
  return ok
}
