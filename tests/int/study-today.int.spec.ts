import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { getStudyOverview } from '@/features/study-today/queries'
import type { Enrollment, Program, SlotType } from '@/payload-types'

let payload: Payload
let owner: TypedUser
let anna: TypedUser
let boris: TypedUser
let program: Program
let short: Program
let anki: SlotType
let series: SlotType

const context = { disableRevalidate: true }
const emails = {
  owner: 'stoday-owner@example.com',
  anna: 'stoday-anna@example.com',
  boris: 'stoday-boris@example.com',
}
const slugs = { main: 'stoday-main', short: 'stoday-short' }

const asUser = (doc: { id: number | string }): TypedUser =>
  ({ ...doc, collection: 'users' }) as unknown as TypedUser

async function quietly<T>(work: () => Promise<T>): Promise<T> {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  try {
    return await work()
  } finally {
    info.mockRestore()
  }
}

const placement = { test: 'murad', cefr: 'B1', takenAt: '2026-10-01T12:00:00.000Z' } as const

const assign = (student: TypedUser, forProgram: Program) =>
  quietly(
    () =>
      payload.create({
        collection: 'enrollments',
        overrideAccess: false,
        user: owner,
        data: { student: student.id as number, program: forProgram.id, placement } as never,
      }) as Promise<Enrollment>,
  )

async function start(enrollment: Enrollment, startDate: string, status = 'active') {
  await payload.db.updateOne({
    collection: 'enrollments',
    id: enrollment.id,
    data: { status, timezone: 'Asia/Almaty', startDate: `${startDate}T00:00:00.000Z` },
  })
}

async function cleanup() {
  await payload.delete({
    collection: 'enrollments',
    where: { 'program.slug': { in: Object.values(slugs) } },
  })
  await payload.delete({
    collection: 'programs',
    where: { slug: { in: Object.values(slugs) } },
    context,
  })
  await payload.delete({
    collection: 'slot-types',
    where: { name: { like: 'stoday ' } },
    context,
  })
  await payload.delete({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    context,
  })
}

describe('«Сегодня» overview (story 013)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await cleanup()
    owner = asUser(
      await payload.create({ collection: 'users', data: { email: emails.owner, role: 'owner' } }),
    )
    anna = asUser(
      await quietly(() =>
        payload.create({ collection: 'users', data: { email: emails.anna, role: 'student' } }),
      ),
    )
    boris = asUser(
      await quietly(() =>
        payload.create({ collection: 'users', data: { email: emails.boris, role: 'student' } }),
      ),
    )
    anki = await payload.create({
      collection: 'slot-types',
      context,
      data: { name: 'stoday Anki', description: 'Cards of the day', defaultMinMinutes: 20 },
    })
    series = await payload.create({
      collection: 'slot-types',
      context,
      data: { name: 'stoday Series', defaultMinMinutes: 30 },
    })
    const week = (day1: unknown[]) => [
      { slots: day1 },
      { slots: [] },
      { slots: [{ slotType: anki.id }] },
      { slots: [] },
      { slots: [] },
      { slots: [] },
      { slots: [] },
    ]
    program = (await payload.create({
      collection: 'programs',
      context,
      data: {
        slug: slugs.main,
        title: 'stoday main',
        levelFrom: 'B1',
        levelTo: 'B2',
        durationWeeks: 52,
        status: 'published',
        weekTemplate: week([{ slotType: anki.id }, { slotType: series.id, minMinutes: 40 }]),
      } as never,
    })) as Program
    short = (await payload.create({
      collection: 'programs',
      context,
      data: {
        slug: slugs.short,
        title: 'stoday short',
        levelFrom: 'B1',
        levelTo: 'B2',
        durationWeeks: 1,
        status: 'published',
        weekTemplate: week([{ slotType: anki.id }]),
      } as never,
    })) as Program
  })

  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  it('1/2. day 10: program day, week, slots with names, minimum and description', async () => {
    const enrollment = await assign(anna, program)
    await start(enrollment, '2026-10-01')
    const now = new Date('2026-10-10T05:00:00.000Z') // 10:00 in Almaty
    const view = await getStudyOverview(payload, anna, 'ru', now)
    if (view.kind !== 'ready') throw new Error('expected a started program')
    expect(view).toMatchObject({
      status: 'active',
      programTitle: 'stoday main',
      totalDays: 364,
      today: 10,
      startDate: '2026-10-01',
    })
    expect(view.template).toHaveLength(7)
    expect(view.template[0]!.slots).toEqual([
      { name: 'stoday Anki', description: 'Cards of the day', minutes: 20 },
      { name: 'stoday Series', description: null, minutes: 40 },
    ])
    expect(view.template[1]!.slots).toEqual([])
    expect(view.template[2]!.slots[0]).toMatchObject({ name: 'stoday Anki', minutes: 20 })
  })

  it('9. «today» follows Asia/Almaty, not the UTC clock', async () => {
    const view = await getStudyOverview(payload, anna, 'ru', new Date('2026-10-09T23:30:00.000Z'))
    expect(view).toMatchObject({ kind: 'ready', today: 10 })
  })

  it('shows nothing for a student without a started program, and never another student’s', async () => {
    expect(await getStudyOverview(payload, boris, 'ru')).toEqual({ kind: 'none' })
    const assigned = await assign(boris, program) // assigned, not started: the start card (012)
    expect(assigned.status).toBe('assigned')
    expect(await getStudyOverview(payload, boris, 'ru')).toEqual({ kind: 'none' })
  })

  it('8. past the last day the enrollment becomes finished and is still shown', async () => {
    await payload.delete({ collection: 'enrollments', where: { student: { equals: boris.id } } })
    const enrollment = await assign(boris, short)
    await start(enrollment, '2026-09-01') // 1 week long, long over
    const view = await getStudyOverview(payload, boris, 'ru', new Date('2026-10-10T05:00:00.000Z'))
    expect(view).toMatchObject({ kind: 'ready', status: 'finished' })
    const stored = await payload.findByID({ collection: 'enrollments', id: enrollment.id })
    expect(stored.status).toBe('finished')
    // The next visit finds it finished and shows it again.
    expect(
      await getStudyOverview(payload, boris, 'ru', new Date('2026-10-11T05:00:00.000Z')),
    ).toMatchObject({ kind: 'ready', status: 'finished' })
  })

  it('does not finish a program on its last day', async () => {
    const enrollment = (
      await payload.find({
        collection: 'enrollments',
        where: { student: { equals: anna.id } },
        depth: 0,
      })
    ).docs[0]!
    await start(enrollment, '2026-10-01')
    // Day 364 of 52 weeks = 363 days after the start.
    const view = await getStudyOverview(payload, anna, 'ru', new Date('2027-09-29T05:00:00.000Z'))
    expect(view).toMatchObject({ kind: 'ready', status: 'active', today: 364 })
    const over = await getStudyOverview(payload, anna, 'ru', new Date('2027-09-30T05:00:00.000Z'))
    expect(over).toMatchObject({ kind: 'ready', status: 'finished', today: 365 })
  })
})
