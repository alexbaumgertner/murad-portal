import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { getDayComments } from '@/features/day-comments/queries'
import { saveDayComment } from '@/features/day-comments/service'
import type { DayComment, Enrollment, Program } from '@/payload-types'

let payload: Payload
let owner: TypedUser
let anna: TypedUser
let boris: TypedUser
let carol: TypedUser
let program: Program
let annaEnrollment: Enrollment
let borisEnrollment: Enrollment

const context = { disableRevalidate: true }
const slug = 'comments-main'
const emails = {
  owner: 'comments-owner@example.com',
  anna: 'comments-anna@example.com',
  boris: 'comments-boris@example.com',
  carol: 'comments-carol@example.com',
}

// Program day 1 is 2026-10-01 in Almaty (UTC+5); "now" is 10:00 on 2026-10-10 = program day 10.
const NOW = new Date('2026-10-10T05:00:00.000Z')
const TODAY = '2026-10-10'
const PAST = '2026-10-05'

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

async function enroll(student: TypedUser): Promise<Enrollment> {
  const enrollment = (await quietly(() =>
    payload.create({
      collection: 'enrollments',
      overrideAccess: false,
      user: owner,
      data: { student: student.id as number, program: program.id, placement } as never,
    }),
  )) as Enrollment
  await payload.db.updateOne({
    collection: 'enrollments',
    id: enrollment.id,
    data: { status: 'active', timezone: 'Asia/Almaty', startDate: '2026-10-01T00:00:00.000Z' },
  })
  return enrollment
}

const comments = async (enrollment: Enrollment) =>
  (
    await payload.find({
      collection: 'day-comments',
      where: { enrollment: { equals: enrollment.id } },
      sort: 'date',
      pagination: false,
      depth: 0,
    })
  ).docs as DayComment[]

async function ok<T extends { ok: boolean }>(promise: Promise<T>) {
  const result = await promise
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`)
  return result as Extract<T, { ok: true }>
}

async function cleanup() {
  await payload.delete({
    collection: 'day-comments',
    where: { 'enrollment.program.slug': { equals: slug } },
  })
  await payload.delete({ collection: 'enrollments', where: { 'program.slug': { equals: slug } } })
  await payload.delete({ collection: 'programs', where: { slug: { equals: slug } }, context })
  await payload.delete({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    context,
  })
}

describe('day comments (story 016)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await cleanup()
    owner = asUser(
      await payload.create({ collection: 'users', data: { email: emails.owner, role: 'owner' } }),
    )
    const student = (email: string, name?: string) =>
      quietly(() =>
        payload.create({ collection: 'users', data: { email, role: 'student', name } }),
      ).then(asUser)
    anna = await student(emails.anna, 'Анна')
    boris = await student(emails.boris, 'Борис')
    carol = await student(emails.carol) // no program
    const rest = { slots: [] }
    program = (await payload.create({
      collection: 'programs',
      context,
      data: {
        slug,
        title: 'comments main',
        levelFrom: 'B1',
        levelTo: 'B2',
        durationWeeks: 52,
        status: 'published',
        weekTemplate: [rest, rest, rest, rest, rest, rest, rest],
      } as never,
    })) as Program
    annaEnrollment = await enroll(anna)
    borisEnrollment = await enroll(boris)
  })

  beforeEach(async () => {
    await payload.delete({
      collection: 'day-comments',
      where: { enrollment: { in: [annaEnrollment.id, borisEnrollment.id] } },
    })
  })

  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  it('1. a comment on today and on a past day is stored for her own enrollment', async () => {
    const text = 'Не понял Present Perfect в серии 3'
    await ok(saveDayComment(payload, anna, { date: TODAY, text }, NOW))
    await ok(saveDayComment(payload, anna, { date: PAST, text: 'Тяжело' }, NOW))

    expect(await comments(annaEnrollment)).toMatchObject([
      { date: '2026-10-05T00:00:00.000Z', text: 'Тяжело' },
      { date: '2026-10-10T00:00:00.000Z', text },
    ])
    expect(await comments(borisEnrollment)).toEqual([])

    const own = await getDayComments(payload, anna)
    expect(own.get(TODAY)).toBe(text)
    expect(own.get(PAST)).toBe('Тяжело')
  })

  it('2. the owner sees student name, program, program day, date and text; filters by student', async () => {
    await ok(saveDayComment(payload, anna, { date: PAST, text: 'старый' }, NOW))
    await ok(saveDayComment(payload, anna, { date: TODAY, text: 'новый' }, NOW))
    await ok(saveDayComment(payload, boris, { date: TODAY, text: 'от Бориса' }, NOW))

    const all = await payload.find({
      collection: 'day-comments',
      where: { 'enrollment.program.slug': { equals: slug } },
      sort: ['-date', '-updatedAt'],
      overrideAccess: false,
      user: owner,
      depth: 0,
    })
    expect(all.docs).toHaveLength(3)
    expect(all.docs.map((doc) => doc.text)).toEqual(['от Бориса', 'новый', 'старый'])
    expect(all.docs[1]).toMatchObject({
      studentName: 'Анна',
      programTitle: 'comments main',
      programDay: 10,
      date: '2026-10-10T00:00:00.000Z',
      text: 'новый',
    })
    expect(all.docs[2]).toMatchObject({ programDay: 5 })

    const annas = await payload.find({
      collection: 'day-comments',
      where: { student: { equals: anna.id } },
      overrideAccess: false,
      user: owner,
      depth: 0,
    })
    expect(annas.docs.map((doc) => doc.text).sort()).toEqual(['новый', 'старый'])
  })

  it('3. saving again replaces the text; empty text deletes the comment', async () => {
    await ok(saveDayComment(payload, anna, { date: TODAY, text: 'первое' }, NOW))
    const again = await ok(saveDayComment(payload, anna, { date: TODAY, text: 'второе' }, NOW))
    expect(again.saved).toBe(true)
    expect(await comments(annaEnrollment)).toMatchObject([{ text: 'второе' }])

    const cleared = await ok(saveDayComment(payload, anna, { date: TODAY, text: '' }, NOW))
    expect(cleared.saved).toBe(false)
    expect(await comments(annaEnrollment)).toEqual([])
    // Clearing a day that has no comment is not an error.
    await ok(saveDayComment(payload, anna, { date: TODAY, text: '' }, NOW))
  })

  it('3. two saves at once leave one comment', async () => {
    await Promise.all([
      saveDayComment(payload, anna, { date: TODAY, text: 'a' }, NOW),
      saveDayComment(payload, anna, { date: TODAY, text: 'b' }, NOW),
    ])
    expect(await comments(annaEnrollment)).toHaveLength(1)
  })

  it('4. 1001 characters are refused, 1000 are stored', async () => {
    expect(
      await saveDayComment(payload, anna, { date: TODAY, text: 'a'.repeat(1001) }, NOW),
    ).toEqual({ ok: false, error: 'too_long' })
    expect(await comments(annaEnrollment)).toEqual([])
    await ok(saveDayComment(payload, anna, { date: TODAY, text: 'a'.repeat(1000) }, NOW))
    expect((await comments(annaEnrollment))[0]?.text).toHaveLength(1000)
  })

  it('5. a future day, and a day before the start are refused', async () => {
    expect(await saveDayComment(payload, anna, { date: '2026-10-11', text: 'x' }, NOW)).toEqual({
      ok: false,
      error: 'future_day',
    })
    expect(await saveDayComment(payload, anna, { date: '2026-09-30', text: 'x' }, NOW)).toEqual({
      ok: false,
      error: 'invalid_day',
    })
    expect(await comments(annaEnrollment)).toEqual([])
  })

  it('5. no program: nothing is saved', async () => {
    expect(await saveDayComment(payload, carol, { date: TODAY, text: 'x' }, NOW)).toEqual({
      ok: false,
      error: 'no_program',
    })
  })

  it('5. API: a student cannot create, update or delete a comment directly (403)', async () => {
    const data = { enrollment: annaEnrollment.id, date: `${TODAY}T00:00:00.000Z`, text: 'hack' }
    await expect(
      payload.create({ collection: 'day-comments', data, overrideAccess: false, user: anna }),
    ).rejects.toMatchObject({ status: 403 })

    await ok(saveDayComment(payload, anna, { date: TODAY, text: 'mine' }, NOW))
    const [mine] = await comments(annaEnrollment)
    await expect(
      payload.update({
        collection: 'day-comments',
        id: mine!.id,
        data: { text: 'changed' },
        overrideAccess: false,
        user: anna,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.delete({
        collection: 'day-comments',
        id: mine!.id,
        overrideAccess: false,
        user: anna,
      }),
    ).rejects.toMatchObject({ status: 403 })
    expect((await comments(annaEnrollment))[0]?.text).toBe('mine')
  })

  it('6. another student sees none of it; anonymous is refused', async () => {
    await ok(saveDayComment(payload, anna, { date: TODAY, text: 'private' }, NOW))
    const [mine] = await comments(annaEnrollment)

    const borisSees = await payload.find({
      collection: 'day-comments',
      overrideAccess: false,
      user: boris,
      depth: 0,
    })
    expect(borisSees.docs).toEqual([])
    await expect(
      payload.findByID({
        collection: 'day-comments',
        id: mine!.id,
        overrideAccess: false,
        user: boris,
      }),
    ).rejects.toThrow()
    expect((await getDayComments(payload, boris)).size).toBe(0)

    await expect(
      payload.find({ collection: 'day-comments', overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.findByID({ collection: 'day-comments', id: mine!.id, overrideAccess: false }),
    ).rejects.toThrow()

    const annaSees = await payload.find({
      collection: 'day-comments',
      overrideAccess: false,
      user: anna,
      depth: 0,
    })
    expect(annaSees.docs.map((doc) => doc.text)).toEqual(['private'])
  })

  it('unique per enrollment and date, even for the owner', async () => {
    await ok(saveDayComment(payload, anna, { date: TODAY, text: 'one' }, NOW))
    await expect(
      payload.create({
        collection: 'day-comments',
        data: { enrollment: annaEnrollment.id, date: `${TODAY}T00:00:00.000Z`, text: 'two' },
      }),
    ).rejects.toThrow()
  })

  it('deleting an enrollment removes its comments', async () => {
    const extra = await enroll(carol)
    await ok(saveDayComment(payload, carol, { date: TODAY, text: 'bye' }, NOW))
    expect(await comments(extra)).toHaveLength(1)
    await payload.delete({ collection: 'enrollments', id: extra.id })
    expect(
      (await payload.find({ collection: 'day-comments', where: { text: { equals: 'bye' } } })).docs,
    ).toEqual([])
  })
})
