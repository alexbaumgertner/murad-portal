import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { listStudentDashboard } from '@/features/owner-progress/dashboard-queries'
import { mondayOf } from '@/features/planner/shape'
import { addRow, createPlanner, saveNote, setCellText, setDone } from '@/features/planner/service'

let payload: Payload
let owner: TypedUser
const students: Record<string, TypedUser> = {}

const context = { disableRevalidate: true, skipEmail: true }
const names = ['anna', 'boris', 'clara', 'dan', 'eva'] as const
const email = (name: string) => `od-${name}@example.com`
const ownerEmail = 'od-owner@example.com'
const allEmails = [
  ownerEmail,
  ...names.map(email),
  'od-extra1@example.com',
  'od-extra2@example.com',
]

// Cell updatedAt is the real clock, so the planner is based on the real current week.
const NOW = new Date()
const MONDAY = mondayOf(NOW.toISOString().slice(0, 10))

const asUser = (doc: { id: number | string }): TypedUser =>
  ({ ...doc, collection: 'users' }) as unknown as TypedUser

async function clean() {
  const found = await payload.find({
    collection: 'users',
    where: { email: { in: allEmails } },
    pagination: false,
    depth: 0,
  })
  await payload.delete({
    collection: 'planners',
    where: { student: { in: found.docs.map((u) => u.id) } },
    context,
  })
  await payload.delete({ collection: 'users', where: { email: { in: allEmails } }, context })
}

async function makeStudent(name: string, address = email(name)) {
  return asUser(
    await payload.create({
      collection: 'users',
      data: { email: address, role: 'student', name },
      context,
    }),
  )
}

async function weekIdOf(student: TypedUser): Promise<number> {
  const planner = (
    await payload.find({
      collection: 'planners',
      where: { student: { equals: student.id } },
      depth: 0,
    })
  ).docs[0]!
  const week = (
    await payload.find({
      collection: 'planner-weeks',
      where: { planner: { equals: planner.id }, index: { equals: 0 } },
      depth: 0,
    })
  ).docs[0]!
  return week.id
}

const rowOf = async (name: string) =>
  (await listStudentDashboard(payload, owner, 'ru', NOW)).find((row) => row.name === name)!

beforeAll(async () => {
  payload = await getPayload({ config })
  await clean()
  owner = asUser(
    await payload.create({
      collection: 'users',
      data: { email: ownerEmail, role: 'owner' },
      context,
    }),
  )
  for (const name of names) students[name] = await makeStudent(name)

  // Anna: two tasks on Monday, one done → 1 / 2, not idle.
  await createPlanner(payload, owner, { studentId: Number(students.anna!.id), baseDate: MONDAY })
  let week = await weekIdOf(students.anna!)
  await addRow(payload, owner, week)
  await setCellText(payload, owner, { weekId: week, row: 0, day: 0, text: 'Anki' })
  await setCellText(payload, owner, { weekId: week, row: 1, day: 0, text: 'Reading' })
  await setDone(payload, students.anna!, { weekId: week, row: 0, day: 0, done: true })

  // Boris: a task due today or earlier, never ticked → idle.
  await createPlanner(payload, owner, { studentId: Number(students.boris!.id), baseDate: MONDAY })
  week = await weekIdOf(students.boris!)
  await setCellText(payload, owner, { weekId: week, row: 0, day: 0, text: 'Listening' })

  // Clara: a planner with an empty current week → noTasks.
  await createPlanner(payload, owner, { studentId: Number(students.clara!.id), baseDate: MONDAY })

  // Dan: a ticked task and a question in the diary → questions.
  await createPlanner(payload, owner, { studentId: Number(students.dan!.id), baseDate: MONDAY })
  week = await weekIdOf(students.dan!)
  await setCellText(payload, owner, { weekId: week, row: 0, day: 0, text: 'Podcast' })
  await setDone(payload, students.dan!, { weekId: week, row: 0, day: 0, done: true })
  await saveNote(payload, students.dan!, { weekId: week, kind: 'questions', day: 1, text: 'Why?' })
  // Eva has nothing.
})

afterAll(async () => {
  await clean()
  await payload.destroy()
})

describe('story 030 · owner dashboard', () => {
  it('1. refuses a user who is not the owner', async () => {
    await expect(listStudentDashboard(payload, students.anna!, 'ru', NOW)).rejects.toThrow(
      'forbidden',
    )
  })

  it('2. one row per student across planner / no planner', async () => {
    const rows = (await listStudentDashboard(payload, owner, 'ru', NOW)).filter((row) =>
      names.includes(row.name as (typeof names)[number]),
    )
    expect(rows.map((row) => row.name).sort()).toEqual([...names].sort())
    expect((await rowOf('eva')).signals).toEqual(['noPlanner'])
    expect((await rowOf('eva')).hasPlanner).toBe(false)
    expect((await rowOf('anna')).plannerId).not.toBeNull()
  })

  it('3. week progress counts the written tasks', async () => {
    const anna = await rowOf('anna')
    expect(anna.stats).toEqual({ total: 2, done: 1 })
    expect(anna.percent).toBe(50)
    expect(anna.currentWeek).toBe(1)
    expect(anna.lastTick).toBe(NOW.toISOString().slice(0, 10))
    expect(anna.signals).toEqual([])
  })

  it('4. signals come out of the real data', async () => {
    expect((await rowOf('boris')).signals).toEqual(['idle'])
    expect((await rowOf('clara')).signals).toEqual(['noTasks'])
    const dan = await rowOf('dan')
    expect(dan.signals).toEqual(['questions'])
    expect(dan.needsHelp).toBe(true)
  })

  it('6. students who need help come first', async () => {
    const order = (await listStudentDashboard(payload, owner, 'ru', NOW))
      .map((row) => row.name)
      .filter((name) => (names as readonly string[]).includes(name))
    expect(order.indexOf('eva')).toBe(order.length - 1)
    expect(order.indexOf('anna')).toBeGreaterThan(order.indexOf('dan'))
    expect(order.indexOf('boris')).toBeLessThan(order.indexOf('anna'))
  })

  it('9. the number of reads does not grow with the students, nothing private is read', async () => {
    const spy = vi.spyOn(payload, 'find')
    await listStudentDashboard(payload, owner, 'ru', NOW)
    const before = spy.mock.calls.length
    await makeStudent('extra1', 'od-extra1@example.com')
    await makeStudent('extra2', 'od-extra2@example.com')
    spy.mockClear()
    const rows = await listStudentDashboard(payload, owner, 'ru', NOW)
    expect(spy.mock.calls.length).toBe(before)
    spy.mockRestore()
    expect(before).toBeLessThanOrEqual(10)
    expect(JSON.stringify(rows)).not.toMatch(/placement|appearance/)
  })

  it('10. reading changes nothing', async () => {
    const count = async () =>
      (await payload.count({ collection: 'planner-cells' })).totalDocs +
      (await payload.count({ collection: 'planner-notes' })).totalDocs +
      (await payload.count({ collection: 'planner-weeks' })).totalDocs
    const before = await count()
    await listStudentDashboard(payload, owner, 'ru', NOW)
    expect(await count()).toBe(before)
  })
})
