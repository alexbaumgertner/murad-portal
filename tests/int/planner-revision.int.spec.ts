import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { getPlannerRevisionAction } from '@/features/planner/actions'
import { getPlannerRevision } from '@/features/planner/queries'
import { addRow, createPlanner, saveNote, setCellText } from '@/features/planner/service'

const session = vi.hoisted(() => ({ user: null as unknown }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/features/auth/current-user', () => ({ currentUser: async () => session.user }))

let payload: Payload
let owner: TypedUser
let anna: TypedUser
let boris: TypedUser
let plannerId: number
let weekId: number

const context = { disableRevalidate: true }
const emails = {
  owner: 'revision-owner@example.com',
  anna: 'revision-anna@example.com',
  boris: 'revision-boris@example.com',
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

beforeAll(async () => {
  payload = await getPayload({ config })
  await clean()
  owner = asUser(
    await payload.create({ collection: 'users', data: { email: emails.owner, role: 'owner' } }),
  )
  const student = (email: string) =>
    payload
      .create({
        collection: 'users',
        data: { email, role: 'student' },
        context: { skipEmail: true },
      })
      .then(asUser)
  anna = await student(emails.anna)
  boris = await student(emails.boris)
  await createPlanner(payload, owner, { studentId: Number(anna.id), baseDate: '2026-10-12' })
  const planner = (
    await payload.find({
      collection: 'planners',
      where: { student: { equals: anna.id } },
      depth: 0,
    })
  ).docs[0]!
  plannerId = planner.id
  weekId = (
    await payload.find({
      collection: 'planner-weeks',
      where: { planner: { equals: plannerId } },
      depth: 0,
    })
  ).docs[0]!.id
})

afterAll(async () => {
  await clean()
  await payload.destroy()
})

describe('story 032 · planner revision', () => {
  it('6. the owner and the planner’s own student read it; another student gets null', async () => {
    expect(await getPlannerRevision(payload, owner, plannerId)).toEqual(expect.any(String))
    expect(await getPlannerRevision(payload, anna, plannerId)).toEqual(expect.any(String))
    expect(await getPlannerRevision(payload, boris, plannerId)).toBeNull()
    expect(await getPlannerRevision(payload, owner, 999_999_999)).toBeNull()
  })

  it('6. the action answers unauthorized, not_found and invalid_input', async () => {
    session.user = null
    expect(await getPlannerRevisionAction({ plannerId })).toEqual({
      status: 'error',
      error: 'unauthorized',
    })
    session.user = boris
    expect(await getPlannerRevisionAction({ plannerId })).toEqual({
      status: 'error',
      error: 'not_found',
    })
    session.user = anna
    expect(await getPlannerRevisionAction({ plannerId })).toMatchObject({ status: 'success' })
    expect(await getPlannerRevisionAction({ plannerId: 'x' })).toEqual({
      status: 'error',
      error: 'invalid_input',
    })
  })

  it('1–2. a written task, a note and a new row each change the signature', async () => {
    let before = await getPlannerRevision(payload, anna, plannerId)
    await setCellText(payload, owner, { weekId, row: 0, day: 0, text: 'PODCAST' })
    let after = await getPlannerRevision(payload, anna, plannerId)
    expect(after).not.toBe(before)
    before = after
    await saveNote(payload, anna, { weekId, kind: 'exercises', day: 0, text: 'done it' })
    after = await getPlannerRevision(payload, owner, plannerId)
    expect(after).not.toBe(before)
    before = after
    await addRow(payload, owner, weekId)
    expect(await getPlannerRevision(payload, anna, plannerId)).not.toBe(before)
  })

  it('4. an emptied cell (its record is deleted) changes the signature', async () => {
    await setCellText(payload, owner, { weekId, row: 0, day: 1, text: 'READ' })
    const before = await getPlannerRevision(payload, anna, plannerId)
    await setCellText(payload, owner, { weekId, row: 0, day: 1, text: '' })
    expect(await getPlannerRevision(payload, anna, plannerId)).not.toBe(before)
  })
})
