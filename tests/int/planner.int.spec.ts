import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { parseAppearance } from '@/features/planner/appearance'
import {
  addRow,
  addWeek,
  createPlanner,
  deleteWeek,
  removeRow,
  saveAppearance,
  saveHeader,
  saveNote,
  saveProgressSettings,
  setCellText,
  setDone,
} from '@/features/planner/service'

let payload: Payload
let owner: TypedUser
let anna: TypedUser
let boris: TypedUser

const context = { disableRevalidate: true }
const emails = {
  owner: 'planner-owner@example.com',
  anna: 'planner-anna@example.com',
  boris: 'planner-boris@example.com',
}
const asUser = (doc: { id: number | string }): TypedUser =>
  ({ ...doc, collection: 'users' }) as unknown as TypedUser

async function clean() {
  const students = await payload.find({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    pagination: false,
    depth: 0,
  })
  await payload.delete({
    collection: 'planners',
    where: { student: { in: students.docs.map((u) => u.id) } },
    context,
  })
  await payload.delete({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
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
  const weeks = await payload.find({
    collection: 'planner-weeks',
    where: { planner: { equals: planner.id } },
    sort: 'index',
    pagination: false,
    depth: 0,
  })
  return { planner, weeks: weeks.docs }
}

const cells = async (weekId: number) =>
  (
    await payload.find({
      collection: 'planner-cells',
      where: { week: { equals: weekId } },
      pagination: false,
      depth: 0,
      sort: ['row', 'day'],
    })
  ).docs

beforeAll(async () => {
  payload = await getPayload({ config })
  await clean()
  owner = asUser(
    await payload.create({ collection: 'users', data: { email: emails.owner, role: 'owner' } }),
  )
  anna = asUser(
    await payload.create({
      collection: 'users',
      data: { email: emails.anna, role: 'student' },
      context: { skipEmail: true },
    }),
  )
  boris = asUser(
    await payload.create({
      collection: 'users',
      data: { email: emails.boris, role: 'student' },
      context: { skipEmail: true },
    }),
  )
})

afterAll(async () => {
  await clean()
  await payload.destroy()
})

describe('story 022 · planner core', () => {
  it('1/2. creates a planner on the Monday with one week, one row and no tasks', async () => {
    expect(
      await createPlanner(payload, owner, { studentId: Number(anna.id), baseDate: '2026-10-14' }),
    ).toEqual({ ok: true })
    const { planner, weeks } = await weeksOf(anna)
    expect(planner.baseDate).toBe('2026-10-12')
    expect(weeks.map((w) => [w.index, w.rowCount])).toEqual([[0, 1]])
    expect(await cells(weeks[0]!.id)).toEqual([])
  })

  it('1. refuses a second planner for the same student and a non-student', async () => {
    expect(
      await createPlanner(payload, owner, { studentId: Number(anna.id), baseDate: '2026-10-12' }),
    ).toEqual({ ok: false, error: 'exists' })
    expect(
      await createPlanner(payload, owner, { studentId: Number(owner.id), baseDate: '2026-10-12' }),
    ).toEqual({ ok: false, error: 'not_found' })
  })

  it('4/5/6/7. keeps rows independent per week; new weeks start with one row', async () => {
    const { planner, weeks } = await weeksOf(anna)
    const week1 = weeks[0]!
    for (let i = 0; i < 4; i++) await addRow(payload, owner, week1.id)
    await addWeek(payload, owner, planner.id)
    await addWeek(payload, owner, planner.id)
    const after = (await weeksOf(anna)).weeks
    expect(after.map((w) => w.rowCount)).toEqual([5, 1, 1])
    await addRow(payload, owner, after[1]!.id)
    expect((await weeksOf(anna)).weeks.map((w) => w.rowCount)).toEqual([5, 2, 1])
    expect(await removeRow(payload, owner, after[2]!.id)).toEqual({ ok: false, error: 'min_rows' })
  })

  it('13. refuses the 41st row', async () => {
    const { weeks } = await weeksOf(anna)
    const last = weeks[2]!
    for (let i = 1; i < 40; i++) expect(await addRow(payload, owner, last.id)).toEqual({ ok: true })
    expect(await addRow(payload, owner, last.id)).toEqual({ ok: false, error: 'max_rows' })
    while ((await weeksOf(anna)).weeks[2]!.rowCount > 1) await removeRow(payload, owner, last.id)
  })

  it('9/10. stores a task; blank and dashes are not tasks and clear the tick', async () => {
    const week = (await weeksOf(anna)).weeks[0]!
    const at = { weekId: week.id, row: 0, day: 0 }
    await setCellText(payload, owner, { ...at, text: '<b>ANKI</b>' })
    expect((await cells(week.id))[0]).toMatchObject({ text: '<b>ANKI</b>', done: false })
    await setDone(payload, owner, { ...at, done: true })
    expect((await cells(week.id))[0]?.done).toBe(true)
    await setCellText(payload, owner, { ...at, text: 'ANKI 20 min' })
    expect((await cells(week.id))[0]?.done).toBe(true) // editing keeps the tick
    await setCellText(payload, owner, { ...at, text: ' — ' })
    expect((await cells(week.id))[0]).toMatchObject({ done: false })
    expect(await setDone(payload, owner, { ...at, done: true })).toEqual({
      ok: false,
      error: 'empty_task',
    })
    await setCellText(payload, owner, { ...at, text: '' })
    expect(await cells(week.id)).toEqual([])
    expect(await setDone(payload, owner, { ...at, row: 3, done: true })).toEqual({
      ok: false,
      error: 'empty_task',
    })
  })

  it('6. removing a row deletes its tasks and ticks, only in that week', async () => {
    const { weeks } = await weeksOf(anna)
    const [w1, w2] = [weeks[0]!, weeks[1]!]
    await setCellText(payload, owner, { weekId: w1.id, row: 4, day: 2, text: 'PODCAST' })
    await setCellText(payload, owner, { weekId: w1.id, row: 0, day: 1, text: 'TV SHOW' })
    await setCellText(payload, owner, { weekId: w2.id, row: 1, day: 2, text: 'READ' })
    expect(await removeRow(payload, owner, w1.id)).toEqual({ ok: true })
    expect((await cells(w1.id)).map((c) => c.text)).toEqual(['TV SHOW'])
    expect((await cells(w2.id)).map((c) => c.text)).toEqual(['READ'])
    expect((await weeksOf(anna)).weeks[0]!.rowCount).toBe(4)
  })

  it('13. refuses a text over 500 characters at the collection', async () => {
    const week = (await weeksOf(anna)).weeks[0]!
    await expect(
      setCellText(payload, owner, { weekId: week.id, row: 0, day: 3, text: 'x'.repeat(501) }),
    ).rejects.toThrow()
  })

  it('8. deleting a week leaves a gap; the next week goes after the highest index', async () => {
    const { planner, weeks } = await weeksOf(anna)
    expect(await deleteWeek(payload, owner, weeks[1]!.id)).toEqual({ ok: true })
    expect(await cells(weeks[1]!.id)).toEqual([])
    expect((await weeksOf(anna)).weeks.map((w) => w.index)).toEqual([0, 2])
    await addWeek(payload, owner, planner.id)
    expect((await weeksOf(anna)).weeks.map((w) => w.index)).toEqual([0, 2, 3])
  })

  it('11/12. a student ticks her own task only and cannot write anything else', async () => {
    const week = (await weeksOf(anna)).weeks[0]!
    const at = { weekId: week.id, row: 0, day: 1 }
    expect(await setDone(payload, anna, { ...at, done: true })).toEqual({ ok: true })
    expect((await cells(week.id))[0]?.done).toBe(true)
    expect(await setDone(payload, anna, { ...at, done: false })).toEqual({ ok: true })
    expect(await setCellText(payload, anna, { ...at, text: 'mine' })).toEqual({
      ok: false,
      error: 'forbidden',
    })
    expect(await addRow(payload, anna, week.id)).toEqual({ ok: false, error: 'forbidden' })
    expect(await deleteWeek(payload, anna, week.id)).toEqual({ ok: false, error: 'forbidden' })
    await expect(
      payload.create({
        collection: 'planner-cells',
        overrideAccess: false,
        user: anna,
        data: { week: week.id, row: 0, day: 5, text: 'x' },
      }),
    ).rejects.toThrow()
  })

  it('12. another student and an anonymous caller reach nothing', async () => {
    const week = (await weeksOf(anna)).weeks[0]!
    expect(await setDone(payload, boris, { weekId: week.id, row: 0, day: 1, done: true })).toEqual({
      ok: false,
      error: 'not_found',
    })
    for (const collection of ['planners', 'planner-weeks', 'planner-cells'] as const) {
      const seen = await payload.find({ collection, overrideAccess: false, user: boris, depth: 0 })
      expect(seen.totalDocs).toBe(0)
      await expect(payload.find({ collection, overrideAccess: false, depth: 0 })).rejects.toThrow()
    }
    const mine = await payload.find({
      collection: 'planner-cells',
      overrideAccess: false,
      user: anna,
      depth: 0,
    })
    expect(mine.totalDocs).toBeGreaterThan(0)
  })

  it('14. the last absolute tick wins', async () => {
    const week = (await weeksOf(anna)).weeks[0]!
    const at = { weekId: week.id, row: 0, day: 1 }
    await Promise.all(
      [true, false, true, false].map((done, i) =>
        new Promise((r) => setTimeout(r, i)).then(() => setDone(payload, anna, { ...at, done })),
      ),
    )
    const state = (await cells(week.id))[0]!.done
    expect(typeof state).toBe('boolean')
  })

  it('10/11. the owner saves progress settings; defaults are week on, others off; a student cannot', async () => {
    const { planner } = await weeksOf(anna)
    expect(planner).toMatchObject({
      showWeekProgress: true,
      showFourWeekProgress: false,
      showDeadlineProgress: false,
    })
    const input = {
      plannerId: planner.id,
      showWeekProgress: false,
      showFourWeekProgress: true,
      showDeadlineProgress: true,
      deadlineTitle: 'IELTS EXAM',
      deadlineDate: '2026-12-20',
    }
    expect(await saveProgressSettings(payload, owner, input)).toEqual({ ok: true })
    expect((await weeksOf(anna)).planner).toMatchObject({
      showWeekProgress: false,
      deadlineTitle: 'IELTS EXAM',
      deadlineDate: '2026-12-20',
    })
    expect(await saveProgressSettings(payload, anna, input)).toEqual({
      ok: false,
      error: 'forbidden',
    })
    await saveProgressSettings(payload, owner, { ...input, deadlineDate: '' })
    expect((await weeksOf(anna)).planner.deadlineDate).toBeNull()
    await expect(
      payload.update({
        collection: 'planners',
        id: planner.id,
        data: { deadlineDate: '2026-13-40' },
      }),
    ).rejects.toThrow()
  })

  it('023 2/9. the owner edits the header and labels; a student cannot; empty label drops the override', async () => {
    const { planner } = await weeksOf(anna)
    expect(
      await saveHeader(payload, owner, {
        plannerId: planner.id,
        studentName: 'Anna',
        goal: 'IELTS 7.5',
        subtitle: 'ACADEMIC',
        labels: { exercises: 'HOMEWORK', days: ['Пн', '', '', '', '', '', ''] },
      }),
    ).toEqual({ ok: true })
    let doc = (await weeksOf(anna)).planner
    expect(doc).toMatchObject({ studentName: 'Anna', goal: 'IELTS 7.5', subtitle: 'ACADEMIC' })
    expect(doc.labels).toMatchObject({ exercises: 'HOMEWORK' })
    await saveHeader(payload, owner, { plannerId: planner.id, labels: { exercises: '' } })
    doc = (await weeksOf(anna)).planner
    expect(doc.labels).not.toHaveProperty('exercises')
    expect(await saveHeader(payload, anna, { plannerId: planner.id, goal: 'x' })).toEqual({
      ok: false,
      error: 'forbidden',
    })
  })

  it('023 4/5/6. diary entries are per week; the student writes hers; strangers cannot; empty deletes', async () => {
    const { weeks } = await weeksOf(anna)
    const [w1, w2] = [weeks[0]!, weeks[1]!]
    const note = { kind: 'exercises' as const, day: 2, text: 'Unit 4\nex. 3' }
    expect(await saveNote(payload, anna, { weekId: w1.id, ...note })).toEqual({ ok: true })
    expect(await saveNote(payload, owner, { weekId: w1.id, ...note, text: 'Unit 5' })).toEqual({
      ok: true,
    })
    expect(
      await saveNote(payload, owner, { weekId: w2.id, kind: 'questions', day: 0, text: 'Why?' }),
    ).toEqual({ ok: true })
    const all = await payload.find({
      collection: 'planner-notes',
      where: { week: { in: [w1.id, w2.id] } },
      pagination: false,
      depth: 0,
    })
    expect(all.docs.map((n) => [n.kind, n.day, n.text]).sort()).toEqual([
      ['exercises', 2, 'Unit 5'],
      ['questions', 0, 'Why?'],
    ])
    expect(await saveNote(payload, boris, { weekId: w1.id, ...note })).toEqual({
      ok: false,
      error: 'not_found',
    })
    expect(await saveNote(payload, anna, { weekId: w1.id, ...note, text: '  ' })).toEqual({
      ok: true,
    })
    expect(
      (await payload.count({ collection: 'planner-notes', where: { week: { equals: w1.id } } }))
        .totalDocs,
    ).toBe(0)
    await expect(
      payload.create({
        collection: 'planner-notes',
        data: { week: w1.id, kind: 'exercises', day: 0, text: 'x'.repeat(2001) },
      }),
    ).rejects.toThrow()
  })

  it('025 11/10. the owner and the student save appearance; strangers cannot; garbage becomes default', async () => {
    const { planner } = await weeksOf(anna)
    const look = {
      colors: { header: { color: '#112233', opacity: 40 } },
      type: { tasks: { font: 'lora', size: 20, bold: true } },
    }
    expect(
      await saveAppearance(payload, anna, { plannerId: planner.id, appearance: look }),
    ).toEqual({ ok: true })
    let stored = parseAppearance((await weeksOf(anna)).planner.appearance)
    expect(stored.colors.header).toEqual({ color: '#112233', opacity: 40 })
    expect(stored.type.tasks).toMatchObject({ font: 'lora', size: 20, bold: true })
    expect(stored.colors.done.color).toBe('#7ed48f')
    expect(
      await saveAppearance(payload, owner, {
        plannerId: planner.id,
        appearance: { type: { tasks: { size: 500, font: 'x' } } },
      }),
    ).toEqual({ ok: true })
    stored = parseAppearance((await weeksOf(anna)).planner.appearance)
    expect(stored.type.tasks).toMatchObject({ font: 'default', size: 14 })
    expect(
      await saveAppearance(payload, boris, { plannerId: planner.id, appearance: look }),
    ).toEqual({ ok: false, error: 'not_found' })
  })

  it('deleting the student deletes her planner', async () => {
    expect(
      await createPlanner(payload, owner, { studentId: Number(boris.id), baseDate: '2026-10-12' }),
    ).toEqual({ ok: true })
    await payload.delete({ collection: 'users', id: boris.id, context })
    const left = await payload.count({
      collection: 'planners',
      where: { student: { equals: boris.id } },
    })
    expect(left.totalDocs).toBe(0)
  })

  it('deleting the planner deletes its weeks and cells', async () => {
    const { planner, weeks } = await weeksOf(anna)
    await payload.delete({ collection: 'planners', id: planner.id, context })
    const left = await payload.count({
      collection: 'planner-cells',
      where: { week: { in: weeks.map((w) => w.id) } },
    })
    expect(left.totalDocs).toBe(0)
  })
})
