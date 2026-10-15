import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  addRow,
  addWeek,
  copyWeek,
  createPlanner,
  saveNote,
  setCellText,
  setDone,
} from '@/features/planner/service'

let payload: Payload
let owner: TypedUser
let anna: TypedUser
let boris: TypedUser

const context = { disableRevalidate: true, skipEmail: true }
const emails = {
  owner: 'pcopy-owner@example.com',
  anna: 'pcopy-anna@example.com',
  boris: 'pcopy-boris@example.com',
}
const asUser = (doc: { id: number | string }): TypedUser =>
  ({ ...doc, collection: 'users' }) as unknown as TypedUser

async function clean() {
  const found = await payload.find({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    pagination: false,
    depth: 0,
  })
  await payload.delete({
    collection: 'planners',
    where: { student: { in: found.docs.map((u) => u.id) } },
    context,
  })
  await payload.delete({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    context,
  })
}

const weeksOf = async (student: TypedUser) => {
  const planner = (
    await payload.find({
      collection: 'planners',
      where: { student: { equals: student.id } },
      depth: 0,
    })
  ).docs[0]!
  const weeks = (
    await payload.find({
      collection: 'planner-weeks',
      where: { planner: { equals: planner.id } },
      sort: 'index',
      pagination: false,
      depth: 0,
    })
  ).docs
  return { planner, weeks }
}

const cells = async (weekId: number) =>
  (
    await payload.find({
      collection: 'planner-cells',
      where: { week: { equals: weekId } },
      sort: ['row', 'day'],
      pagination: false,
      depth: 0,
    })
  ).docs.map((c) => ({ row: c.row, day: c.day, text: c.text, done: c.done }))

beforeAll(async () => {
  payload = await getPayload({ config })
  await clean()
  owner = asUser(
    await payload.create({
      collection: 'users',
      data: { email: emails.owner, role: 'owner' },
      context,
    }),
  )
  anna = asUser(
    await payload.create({
      collection: 'users',
      data: { email: emails.anna, role: 'student' },
      context,
    }),
  )
  boris = asUser(
    await payload.create({
      collection: 'users',
      data: { email: emails.boris, role: 'student' },
      context,
    }),
  )
  await createPlanner(payload, owner, { studentId: Number(anna.id), baseDate: '2026-10-12' })
  await createPlanner(payload, owner, { studentId: Number(boris.id), baseDate: '2026-10-12' })
})

afterAll(async () => {
  await clean()
  await payload.destroy()
})

describe('story 031 · create a planner and copy a week', () => {
  it('2. a second planner for the same student is refused, also in parallel', async () => {
    const results = await Promise.all([
      createPlanner(payload, owner, { studentId: Number(anna.id), baseDate: '2026-10-12' }),
      createPlanner(payload, owner, { studentId: Number(anna.id), baseDate: '2026-10-12' }),
    ])
    expect(results.every((r) => !r.ok)).toBe(true)
    expect((await weeksOf(anna)).planner).toBeTruthy()
  })

  it('3. copies rows and texts to a new last week, not ticks or notes; the source stays', async () => {
    const { weeks } = await weeksOf(anna)
    const source = weeks[0]!
    await addRow(payload, owner, source.id)
    await setCellText(payload, owner, { weekId: source.id, row: 0, day: 0, text: 'Anki' })
    await setCellText(payload, owner, { weekId: source.id, row: 1, day: 3, text: 'Reading' })
    await setDone(payload, anna, { weekId: source.id, row: 0, day: 0, done: true })
    await saveNote(payload, anna, { weekId: source.id, kind: 'questions', day: 1, text: 'Why?' })
    // a gap: week index 1 is removed by adding week 1 and 2, then deleting nothing — copy goes after the highest
    await addWeek(payload, owner, (await weeksOf(anna)).planner.id)

    expect(await copyWeek(payload, owner, source.id)).toEqual({ ok: true })

    const after = (await weeksOf(anna)).weeks
    expect(after.map((w) => w.index)).toEqual([0, 1, 2])
    const copy = after[2]!
    expect(copy.rowCount).toBe(2)
    expect(await cells(copy.id)).toEqual([
      { row: 0, day: 0, text: 'Anki', done: false },
      { row: 1, day: 3, text: 'Reading', done: false },
    ])
    expect(
      (await payload.count({ collection: 'planner-notes', where: { week: { equals: copy.id } } }))
        .totalDocs,
    ).toBe(0)
    expect(await cells(source.id)).toEqual([
      { row: 0, day: 0, text: 'Anki', done: true },
      { row: 1, day: 3, text: 'Reading', done: false },
    ])
  })

  it('4. an empty week copies to an empty week with the same rows', async () => {
    const { weeks } = await weeksOf(boris)
    const source = weeks[0]!
    await addRow(payload, owner, source.id)
    await addRow(payload, owner, source.id)
    expect(await copyWeek(payload, owner, source.id)).toEqual({ ok: true })
    const copy = (await weeksOf(boris)).weeks[1]!
    expect(copy.rowCount).toBe(3)
    expect(await cells(copy.id)).toEqual([])
  })

  it('5. a student and an unknown week are refused and nothing is created', async () => {
    const { weeks } = await weeksOf(anna)
    const before = weeks.length
    expect(await copyWeek(payload, anna, weeks[0]!.id)).toEqual({ ok: false, error: 'forbidden' })
    expect(await copyWeek(payload, owner, 999_999_999)).toEqual({ ok: false, error: 'not_found' })
    expect((await weeksOf(anna)).weeks.length).toBe(before)
  })

  it('6. refuses when the last allowed week index is taken', async () => {
    const { planner, weeks } = await weeksOf(boris)
    await payload.create({
      collection: 'planner-weeks',
      data: { planner: planner.id, index: 520, rowCount: 1 },
      overrideAccess: true,
    })
    const before = (await weeksOf(boris)).weeks.length
    expect(await copyWeek(payload, owner, weeks[0]!.id)).toEqual({
      ok: false,
      error: 'too_many_weeks',
    })
    expect((await weeksOf(boris)).weeks.length).toBe(before)
  })
})
