import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createPlanner, setCellText, setOwnTask } from '@/features/planner/service'

let payload: Payload
let owner: TypedUser
let anna: TypedUser
let boris: TypedUser

const context = { disableRevalidate: true }
const emails = {
  owner: 'own-task-owner@example.com',
  anna: 'own-task-anna@example.com',
  boris: 'own-task-boris@example.com',
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
  await payload.delete({ collection: 'users', where: { email: { in: Object.values(emails) } } })
}

const firstWeek = async (student: TypedUser) => {
  const planner = (
    await payload.find({
      collection: 'planners',
      where: { student: { equals: student.id } },
      depth: 0,
    })
  ).docs[0]!
  return (
    await payload.find({
      collection: 'planner-weeks',
      where: { planner: { equals: planner.id } },
      depth: 0,
    })
  ).docs[0]!
}

const cellAt = async (weekId: number, row: number, day: number) =>
  (
    await payload.find({
      collection: 'planner-cells',
      where: { week: { equals: weekId }, row: { equals: row }, day: { equals: day } },
      depth: 0,
    })
  ).docs[0]

beforeAll(async () => {
  payload = await getPayload({ config })
  await clean()
  owner = asUser(
    await payload.create({ collection: 'users', data: { email: emails.owner, role: 'owner' } }),
  )
  const student = (email: string) =>
    payload.create({
      collection: 'users',
      data: { email, role: 'student' },
      context: { skipEmail: true },
    })
  anna = asUser(await student(emails.anna))
  boris = asUser(await student(emails.boris))
  await createPlanner(payload, owner, { studentId: Number(anna.id), baseDate: '2026-10-12' })
})

afterAll(async () => {
  await clean()
  await payload.destroy()
})

describe('story 034 · student own task', () => {
  it('7/8. a student writes her own task in an empty cell, edits it and clears it', async () => {
    const week = await firstWeek(anna)
    const at = { weekId: week.id, row: 0, day: 0 }
    expect(await setOwnTask(payload, anna, { ...at, text: '  read a book  ' })).toEqual({
      ok: true,
    })
    expect(await cellAt(week.id, 0, 0)).toMatchObject({ text: 'read a book', own: true })
    expect(await setOwnTask(payload, anna, { ...at, text: 'read two books' })).toEqual({ ok: true })
    expect(await cellAt(week.id, 0, 0)).toMatchObject({ text: 'read two books', own: true })
    expect(await setCellText(payload, anna, { ...at, text: '' })).toEqual({ ok: true })
    expect(await cellAt(week.id, 0, 0)).toBeUndefined()
  })

  it("9. a student cannot overwrite the owner's task with free text", async () => {
    const week = await firstWeek(anna)
    const at = { weekId: week.id, row: 0, day: 1 }
    await setCellText(payload, owner, { ...at, text: 'FMA' })
    expect(await setOwnTask(payload, anna, { ...at, text: 'mine' })).toEqual({
      ok: false,
      error: 'forbidden',
    })
    expect(await cellAt(week.id, 0, 1)).toMatchObject({ text: 'FMA', own: false })
  })

  it('10. too long or blank text is refused with a code', async () => {
    const week = await firstWeek(anna)
    const at = { weekId: week.id, row: 0, day: 2 }
    expect(await setOwnTask(payload, anna, { ...at, text: 'x'.repeat(501) })).toEqual({
      ok: false,
      error: 'too_long',
    })
    for (const text of ['   ', '-', '—'])
      expect(await setOwnTask(payload, anna, { ...at, text })).toEqual({
        ok: false,
        error: 'empty_task',
      })
    expect(await cellAt(week.id, 0, 2)).toBeUndefined()
  })

  it("11. another student, the owner's own route and an unknown week are refused", async () => {
    const week = await firstWeek(anna)
    const at = { weekId: week.id, row: 0, day: 3 }
    expect((await setOwnTask(payload, boris, { ...at, text: 'sneaky' })).ok).toBe(false)
    expect(await setOwnTask(payload, owner, { ...at, text: 'owner' })).toEqual({
      ok: false,
      error: 'forbidden',
    })
    expect((await setOwnTask(payload, anna, { ...at, weekId: 999999, text: 'x' })).ok).toBe(false)
    expect(await cellAt(week.id, 0, 3)).toBeUndefined()
  })

  it('12. when the owner edits an own-task cell it is his text now', async () => {
    const week = await firstWeek(anna)
    const at = { weekId: week.id, row: 0, day: 4 }
    await setOwnTask(payload, anna, { ...at, text: 'my idea' })
    expect(await setCellText(payload, owner, { ...at, text: 'owner idea' })).toEqual({ ok: true })
    expect(await cellAt(week.id, 0, 4)).toMatchObject({ text: 'owner idea', own: false })
  })
})
