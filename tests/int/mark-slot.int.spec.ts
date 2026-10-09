import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { markSlot, startTimer } from '@/features/slot-timer/service'
import { getStudyOverview } from '@/features/study-today/queries'
import type { Enrollment, Program, SlotLog, SlotType } from '@/payload-types'

let payload: Payload
let owner: TypedUser
let anna: TypedUser
let boris: TypedUser
let program: Program
let anki: SlotType
let series: SlotType
let annaEnrollment: Enrollment
let borisEnrollment: Enrollment

const context = { disableRevalidate: true }
const emails = {
  owner: 'mark-owner@example.com',
  anna: 'mark-anna@example.com',
  boris: 'mark-boris@example.com',
}
const slug = 'mark-main'

// Program starts 2026-10-01 in Almaty (UTC+5); days 3 and 10 are template day 3 = [Anki 20, Series 40].
// «Now» is day 10, 10:00 local.
const T0 = new Date('2026-10-10T05:00:00.000Z')
const PAST = 3
const TODAY = 10

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
  await setStatus(enrollment, 'active', {
    timezone: 'Asia/Almaty',
    startDate: '2026-10-01T00:00:00.000Z',
  })
  return enrollment
}

const setStatus = (
  enrollment: Enrollment,
  status: Enrollment['status'],
  extra: Record<string, unknown> = {},
) =>
  payload.db.updateOne({
    collection: 'enrollments',
    id: enrollment.id,
    data: { status, ...extra },
  })

const logs = async (enrollment: Enrollment) =>
  (
    await payload.find({
      collection: 'slot-logs',
      where: { enrollment: { equals: enrollment.id } },
      sort: ['date', 'slotIndex'],
      pagination: false,
      depth: 0,
    })
  ).docs as SlotLog[]

const logOf = async (enrollment: Enrollment, day: number, slotIndex: number) =>
  (await logs(enrollment)).find(
    (log) => log.slotIndex === slotIndex && log.date.slice(0, 10) === `2026-10-${pad(day)}`,
  )
const pad = (n: number) => String(n).padStart(2, '0')

const mark = (programDay: number, slotIndex: number, minutes: number, user = anna) =>
  markSlot(payload, user, { programDay, slotIndex, minutes }, T0)

async function ok<T extends { ok: boolean }>(promise: Promise<T>) {
  const result = await promise
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`)
  return result as Extract<T, { ok: true }>
}

async function cleanup() {
  await payload.delete({
    collection: 'slot-logs',
    where: { 'enrollment.program.slug': { equals: slug } },
  })
  await payload.delete({ collection: 'enrollments', where: { 'program.slug': { equals: slug } } })
  await payload.delete({ collection: 'programs', where: { slug: { equals: slug } }, context })
  await payload.delete({ collection: 'slot-types', where: { name: { like: 'mark ' } }, context })
  await payload.delete({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    context,
  })
}

describe('mark a slot manually (story 015)', () => {
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
      data: { name: 'mark Anki', defaultMinMinutes: 20 },
    })
    series = await payload.create({
      collection: 'slot-types',
      context,
      data: { name: 'mark Series', defaultMinMinutes: 30 },
    })
    const rest = { slots: [] }
    program = (await payload.create({
      collection: 'programs',
      context,
      data: {
        slug,
        title: 'mark main',
        levelFrom: 'B1',
        levelTo: 'B2',
        durationWeeks: 52,
        status: 'published',
        weekTemplate: [
          rest,
          rest,
          { slots: [{ slotType: anki.id }, { slotType: series.id, minMinutes: 40 }] },
          rest,
          rest,
          rest,
          rest,
        ],
      } as never,
    })) as Program
    annaEnrollment = await enroll(anna)
    borisEnrollment = await enroll(boris)
  })

  beforeEach(async () => {
    await payload.delete({
      collection: 'slot-logs',
      where: { enrollment: { in: [annaEnrollment.id, borisEnrollment.id] } },
    })
    await setStatus(annaEnrollment, 'active')
  })

  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  it('1. 30 minutes on a past slot: minutes = 30, completed = (30 ≥ minimum)', async () => {
    const first = await ok(mark(PAST, 0, 30)) // Anki 20
    expect(first.completedNow).toEqual([{ slotTypeId: anki.id, minutes: 30 }])
    expect(await logOf(annaEnrollment, PAST, 0)).toMatchObject({ minutes: 30, completed: true })

    const second = await ok(mark(PAST, 1, 30)) // Series 40: less than the minimum
    expect(second.completedNow).toEqual([])
    expect(await logOf(annaEnrollment, PAST, 1)).toMatchObject({ minutes: 30, completed: false })
  })

  it('1b. today works too and the state carries the numbers', async () => {
    const { state } = await ok(mark(TODAY, 0, 25))
    expect(state.slots[0]).toMatchObject({ minutes: 25, completed: true, startedAt: null })
  })

  it('2. a missed day turns ½ then ✓ as its slots are marked', async () => {
    const view = async () => {
      const overview = await getStudyOverview(payload, anna, 'ru', T0)
      if (overview.kind !== 'ready') throw new Error('expected a started program')
      return overview.progress.get(PAST)
    }
    expect(await view()).toBeUndefined() // ✕
    await ok(mark(PAST, 0, 20))
    expect(await view()).toEqual({ done: false, minutes: 20 }) // ½
    await ok(mark(PAST, 1, 40))
    expect(await view()).toEqual({ done: true, minutes: 60 }) // ✓
  })

  it('3. marking again updates the record, it is not duplicated', async () => {
    await ok(mark(PAST, 0, 30))
    await ok(mark(PAST, 0, 10))
    const rows = (await logs(annaEnrollment)).filter((log) => log.slotIndex === 0)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ minutes: 10, completed: false }) // the value replaces the total
  })

  it('3b. a slot done twice is counted once for analytics', async () => {
    expect((await ok(mark(PAST, 0, 30))).completedNow).toHaveLength(1)
    expect((await ok(mark(PAST, 0, 45))).completedNow).toEqual([])
  })

  it('4. 0 resets the slot; 601 is refused; non-integers and negatives too', async () => {
    await ok(mark(PAST, 0, 30))
    await ok(mark(PAST, 0, 0))
    expect(await logOf(annaEnrollment, PAST, 0)).toMatchObject({ minutes: 0, completed: false })

    await ok(mark(PAST, 1, 0)) // nothing logged, nothing created
    expect(await logOf(annaEnrollment, PAST, 1)).toBeUndefined()

    expect(await mark(PAST, 0, 601)).toEqual({ ok: false, error: 'too_many_minutes' })
    expect((await ok(mark(PAST, 0, 600))).state).toBeDefined()
    expect((await mark(PAST, 0, 1.5)).ok).toBe(false)
    expect((await mark(PAST, 0, -1)).ok).toBe(false)
    expect(await logOf(annaEnrollment, PAST, 0)).toMatchObject({ minutes: 600 })
  })

  it('5. a future day, day 0 and a day past the program are refused and write nothing', async () => {
    for (const day of [TODAY + 1, 0, -3, 99999]) {
      expect(await mark(day, 0, 30)).toEqual({ ok: false, error: 'forbidden' })
    }
    expect(await logs(annaEnrollment)).toHaveLength(0)
  })

  it('5b. a slot the day does not have, and a rest day, are refused', async () => {
    expect(await mark(PAST, 2, 30)).toEqual({ ok: false, error: 'invalid_slot' })
    expect(await mark(4, 0, 30)).toEqual({ ok: false, error: 'invalid_slot' }) // template day 4 rests
  })

  it('6. a paused or finished program cannot be marked', async () => {
    await setStatus(annaEnrollment, 'paused')
    expect(await mark(PAST, 0, 30)).toEqual({ ok: false, error: 'paused' })
    await setStatus(annaEnrollment, 'finished')
    expect(await mark(PAST, 0, 30)).toEqual({ ok: false, error: 'program_over' })
    expect(await logs(annaEnrollment)).toHaveLength(0)
  })

  it('7. a running timer on that slot is stopped and the manual value replaces the total', async () => {
    await ok(startTimer(payload, anna, 0, T0))
    const { state } = await ok(mark(TODAY, 0, 15))
    const log = await logOf(annaEnrollment, TODAY, 0)
    expect(log).toMatchObject({ minutes: 15, completed: false })
    expect(log?.timerStartedAt ?? null).toBeNull()
    expect(state.slots[0]).toMatchObject({ minutes: 15, startedAt: null })
  })

  it('7b. a timer on another slot keeps running (one timer at a time still holds)', async () => {
    await ok(startTimer(payload, anna, 1, T0))
    await ok(mark(PAST, 0, 30))
    await ok(mark(TODAY, 0, 30))
    expect((await logOf(annaEnrollment, TODAY, 1))?.timerStartedAt).toBe(T0.toISOString())
    expect((await logs(annaEnrollment)).filter((log) => log.timerStartedAt)).toHaveLength(1)
  })

  it('8. the enrollment is the signed-in student’s own: one student never touches another’s logs', async () => {
    await ok(mark(PAST, 0, 30, boris))
    expect(await logs(annaEnrollment)).toHaveLength(0)
    expect(await logs(borisEnrollment)).toHaveLength(1)
  })

  it('9. no program: nothing to mark', async () => {
    const stranger = asUser(
      await quietly(() =>
        payload.create({
          collection: 'users',
          data: { email: 'mark-stranger@example.com', role: 'student' },
        }),
      ),
    )
    try {
      expect(await mark(PAST, 0, 30, stranger)).toEqual({ ok: false, error: 'no_program' })
    } finally {
      await payload.delete({ collection: 'users', id: stranger.id, context })
    }
  })

  it('10. a direct API write by a student stays refused', async () => {
    const base = {
      enrollment: annaEnrollment.id,
      date: '2026-10-03T00:00:00.000Z',
      slotIndex: 0,
      slotType: anki.id,
      minutes: 30,
      completed: true,
    }
    await expect(
      payload.create({ collection: 'slot-logs', overrideAccess: false, user: anna, data: base }),
    ).rejects.toMatchObject({ status: 403 })
    await ok(mark(PAST, 0, 30))
    const own = await logOf(annaEnrollment, PAST, 0)
    await expect(
      payload.update({
        collection: 'slot-logs',
        id: own!.id,
        overrideAccess: false,
        user: anna,
        data: { minutes: 600 },
      }),
    ).rejects.toMatchObject({ status: 403 })
  })
})
