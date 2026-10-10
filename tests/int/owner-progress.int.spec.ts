import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getStudentDetail, listStudentSummaries } from '@/features/owner-progress/queries'
import type { Program, SlotType } from '@/payload-types'

let payload: Payload
let owner: TypedUser
let anna: TypedUser
let boris: TypedUser
let clara: TypedUser
let dan: TypedUser
let program: Program
let short: Program
let anki: SlotType

// No real mailbox behind the demo students: the server-only flag skips the invite and the email.
const context = { disableRevalidate: true, skipEmail: true }
const emails = {
  owner: 'op-owner@example.com',
  anna: 'op-anna@example.com',
  boris: 'op-boris@example.com',
  clara: 'op-clara@example.com',
  dan: 'op-dan@example.com',
}
const slugs = ['op-main', 'op-short']

// Day 1 is 2026-10-01 in Almaty (UTC+5); 10:00 on 2026-10-10 is program day 10, week 2.
const START = '2026-10-01'
const NOW = new Date('2026-10-10T05:00:00.000Z')
const placement = { test: 'murad', cefr: 'B1', takenAt: '2026-09-20T12:00:00.000Z' } as const

const asUser = (doc: { id: number | string }): TypedUser =>
  ({ ...doc, collection: 'users' }) as unknown as TypedUser

async function makeUser(email: string, role: 'owner' | 'student', name?: string) {
  await payload.delete({ collection: 'users', where: { email: { equals: email } }, context })
  return asUser(await payload.create({ collection: 'users', data: { email, role, name }, context }))
}

async function enroll(
  student: TypedUser,
  forProgram: Program,
  state: { status?: string; startDate?: string | null; pauses?: { from: string; to?: string }[] },
) {
  const created = await payload.create({
    collection: 'enrollments',
    data: { student: student.id as number, program: forProgram.id, placement } as never,
    context,
    overrideAccess: false,
    user: owner,
  })
  if (state.status && state.status !== 'assigned') {
    await payload.db.updateOne({
      collection: 'enrollments',
      id: created.id,
      data: {
        status: state.status,
        timezone: 'Asia/Almaty',
        startDate: `${state.startDate ?? START}T00:00:00.000Z`,
      },
    })
  }
  if (state.pauses) {
    await payload.update({
      collection: 'enrollments',
      id: created.id,
      context,
      depth: 0,
      data: {
        pauses: state.pauses.map(({ from, to }) => ({
          from: `${from}T00:00:00.000Z`,
          to: to ? `${to}T00:00:00.000Z` : null,
        })),
      } as never,
    })
  }
  return created
}

const logOf = (
  enrollment: number,
  date: string,
  slotIndex: number,
  minutes: number,
  done: boolean,
) =>
  payload.create({
    collection: 'slot-logs',
    context,
    data: {
      enrollment,
      date: `${date}T00:00:00.000Z`,
      slotIndex,
      slotType: anki.id,
      minutes,
      completed: done,
    },
  })

async function wipe() {
  for (const email of Object.values(emails)) {
    const found = await payload.find({ collection: 'users', where: { email: { equals: email } } })
    for (const user of found.docs) {
      await payload.delete({
        collection: 'enrollments',
        where: { student: { equals: user.id } },
        context,
      })
    }
  }
  await payload.delete({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    context,
  })
  await payload.delete({ collection: 'programs', where: { slug: { in: slugs } }, context })
  await payload.delete({
    collection: 'slot-types',
    where: { name: { equals: 'OP Anki' } },
    context,
  })
}

beforeAll(async () => {
  payload = await getPayload({ config })
  await wipe()
  anki = await payload.create({
    collection: 'slot-types',
    context,
    data: { name: 'OP Anki', defaultMinMinutes: 20 },
  })
  const week = [{ slots: [{ slotType: anki.id }] }, ...Array(6).fill({ slots: [] })]
  const make = (slug: string, durationWeeks: number) =>
    payload.create({
      collection: 'programs',
      context,
      data: {
        slug,
        title: `OP ${slug}`,
        levelFrom: 'B1',
        levelTo: 'B2',
        durationWeeks,
        status: 'published',
        weekTemplate: week,
      } as never,
    })
  program = await make('op-main', 8)
  short = await make('op-short', 1)
  owner = await makeUser(emails.owner, 'owner')
  anna = await makeUser(emails.anna, 'student', 'Анна')
  boris = await makeUser(emails.boris, 'student')
  clara = await makeUser(emails.clara, 'student', 'Клара')
  dan = await makeUser(emails.dan, 'student', 'Дан')
})

afterAll(async () => {
  await wipe()
})

describe('owner progress (story 019)', () => {
  let annaEnrollment: number

  beforeAll(async () => {
    const a = await enroll(anna, program, { status: 'active' })
    annaEnrollment = a.id
    // Day 1 and day 8 are the training days of the first two weeks (template day 1).
    await logOf(a.id, '2026-10-01', 0, 25, true)
    await logOf(a.id, '2026-10-08', 0, 10, false)
    await enroll(boris, program, {
      status: 'paused',
      pauses: [{ from: '2026-10-05' }],
    })
    await enroll(clara, program, { status: 'assigned' })
    await enroll(dan, short, { status: 'active' }) // 1 week: over by day 10
  })

  it('refuses a user who is not the owner', async () => {
    await expect(listStudentSummaries(payload, anna, 'ru', NOW)).rejects.toThrow()
    await expect(getStudentDetail(payload, anna, annaEnrollment, 'ru', NOW)).rejects.toThrow()
  })

  it('lists every student with her numbers', async () => {
    const rows = await listStudentSummaries(payload, owner, 'ru', NOW)
    const byName = new Map(rows.map((row) => [row.name, row]))

    expect(byName.get('Анна')).toMatchObject({
      status: 'active',
      today: 10,
      totalDays: 56,
      programTitle: 'OP op-main',
      levelFrom: 'B1',
      levelTo: 'B2',
      lastStudyDate: '2026-10-08',
      totals: { done: 1, missed: 1, minutes: 35 },
    })
    // A student with no name is listed by her address.
    expect(byName.get(emails.boris)).toMatchObject({ status: 'paused', today: 5 })
    expect(byName.get('Клара')).toMatchObject({ status: 'assigned', today: null, totals: null })
    // Over by day 10, and still `active` in the database: the owner's page never writes.
    expect(byName.get('Дан')?.status).toBe('finished')
    const stored = await payload.find({
      collection: 'enrollments',
      where: { 'student.email': { equals: emails.dan } },
      depth: 0,
    })
    expect(stored.docs[0]?.status).toBe('active')
    // Active and paused come before assigned and finished.
    expect(
      rows
        .map((row) => row.status)
        .slice(0, 2)
        .sort(),
    ).toEqual(['active', 'paused'])
  })

  it('detail has the current and the previous week', async () => {
    const detail = await getStudentDetail(payload, owner, annaEnrollment, 'ru', NOW)
    expect(detail).not.toBeNull()
    expect(detail?.weeks.map((week) => week.week)).toEqual([1, 2])
    const first = detail!.weeks[0]!.cells
    expect(first).toHaveLength(7)
    expect(first[0]).toMatchObject({ programDay: 1, state: 'done' })
    const second = detail!.weeks[1]!.cells
    expect(second[0]).toMatchObject({ programDay: 8, state: 'partial' })
    expect(second.find((cell) => cell.programDay === 9)?.state).toBe('rest')
    // Today is a rest day of the template: it is still marked as today, as on her own page.
    expect(second.find((cell) => cell.programDay === 10)?.state).toBe('today')
  })

  it('shows the pause on the grid of a paused student', async () => {
    const rows = await listStudentSummaries(payload, owner, 'ru', NOW)
    const id = rows.find((row) => row.name === emails.boris)!.enrollmentId
    const detail = await getStudentDetail(payload, owner, id, 'ru', NOW)
    const cells = detail!.weeks.flatMap((week) => week.cells)
    expect(cells.filter((cell) => cell.state === 'paused').length).toBeGreaterThan(0)
  })

  it('comments newest first with program day, line breaks kept', async () => {
    await payload.create({
      collection: 'day-comments',
      context,
      data: {
        enrollment: annaEnrollment,
        student: anna.id as number,
        date: '2026-10-02T00:00:00.000Z',
        text: 'первое',
      },
    })
    await payload.create({
      collection: 'day-comments',
      context,
      data: {
        enrollment: annaEnrollment,
        student: anna.id as number,
        date: '2026-10-08T00:00:00.000Z',
        text: 'строка 1\nстрока 2',
      },
    })
    const detail = await getStudentDetail(payload, owner, annaEnrollment, 'ru', NOW)
    expect(detail?.comments).toEqual([
      { date: '2026-10-08', programDay: 8, text: 'строка 1\nстрока 2' },
      { date: '2026-10-02', programDay: 2, text: 'первое' },
    ])
  })

  it('unknown enrollment is not found', async () => {
    expect(await getStudentDetail(payload, owner, 999_999_999, 'ru', NOW)).toBeNull()
  })

  it('reading changes nothing', async () => {
    const count = async (collection: 'slot-logs' | 'day-comments' | 'enrollments') =>
      (await payload.count({ collection })).totalDocs
    const before = [
      await count('slot-logs'),
      await count('day-comments'),
      await count('enrollments'),
    ]
    await listStudentSummaries(payload, owner, 'ru', NOW)
    await getStudentDetail(payload, owner, annaEnrollment, 'ru', NOW)
    const after = [
      await count('slot-logs'),
      await count('day-comments'),
      await count('enrollments'),
    ]
    expect(after).toEqual(before)
  })

  it('never carries the private placement note', async () => {
    await payload.update({
      collection: 'enrollments',
      id: annaEnrollment,
      context,
      depth: 0,
      data: { placement: { ...placement, note: 'СЕКРЕТ-ЗАМЕТКА' } } as never,
    })
    const detail = await getStudentDetail(payload, owner, annaEnrollment, 'ru', NOW)
    const rows = await listStudentSummaries(payload, owner, 'ru', NOW)
    expect(JSON.stringify([detail, rows])).not.toContain('СЕКРЕТ-ЗАМЕТКА')
  })
})
