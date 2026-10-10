import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { getTimerState, startTimer, stopTimer, syncTimer } from '@/features/slot-timer/service'
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
  owner: 'timer-owner@example.com',
  anna: 'timer-anna@example.com',
  boris: 'timer-boris@example.com',
}
const slug = 'timer-main'

// Day 10 of a program that started 2026-10-01 in Almaty (UTC+5) is template day 3 = [Anki 20, Series 40].
const T0 = new Date('2026-10-10T05:00:00.000Z') // 10:00 in Almaty
const after = (minutes: number, from = T0) => new Date(from.getTime() + minutes * 60_000)

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

const logOf = async (enrollment: Enrollment, slotIndex: number) =>
  (await logs(enrollment)).find((log) => log.slotIndex === slotIndex)

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
  await payload.delete({ collection: 'slot-types', where: { name: { like: 'timer ' } }, context })
  await payload.delete({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    context,
  })
}

describe('slot timer (story 014)', () => {
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
      data: { name: 'timer Anki', defaultMinMinutes: 20 },
    })
    series = await payload.create({
      collection: 'slot-types',
      context,
      data: { name: 'timer Series', defaultMinMinutes: 30 },
    })
    const rest = { slots: [] }
    program = (await payload.create({
      collection: 'programs',
      context,
      data: {
        slug,
        title: 'timer main',
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
  })

  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  it('1. «Старт» saves timerStartedAt and the state carries the running timer', async () => {
    const { state } = await ok(startTimer(payload, anna, 1, T0))
    const log = await logOf(annaEnrollment, 1)
    expect(log).toMatchObject({ minutes: 0, completed: false, date: '2026-10-10T00:00:00.000Z' })
    expect(log?.timerStartedAt).toBe(T0.toISOString())
    expect(typeof log?.slotType === 'object' ? log.slotType.id : log?.slotType).toBe(series.id)
    expect(state.slots[1]).toEqual({
      index: 1,
      minutes: 0,
      completed: false,
      startedAt: T0.toISOString(),
    })
    expect(state.slots[0]).toMatchObject({ startedAt: null })
  })

  it('2. at the minimum the slot is completed once and the timer keeps running', async () => {
    await ok(startTimer(payload, anna, 1, T0))
    const early = await ok(syncTimer(payload, anna, after(39)))
    expect(early.completedNow).toEqual([])
    expect((await logOf(annaEnrollment, 1))?.completed).toBe(false)

    const reached = await ok(syncTimer(payload, anna, after(40)))
    expect(reached.completedNow).toEqual([{ slotTypeId: series.id, minutes: 40 }])
    const log = await logOf(annaEnrollment, 1)
    expect(log?.completed).toBe(true)
    expect(log?.timerStartedAt).toBe(T0.toISOString()) // still running

    const again = await ok(syncTimer(payload, anna, after(41)))
    expect(again.completedNow).toEqual([]) // the signal fires once
  })

  it('3/4. «Стоп» adds whole minutes; 25 of 40 stays not done and the next start continues', async () => {
    await ok(startTimer(payload, anna, 1, T0))
    await ok(stopTimer(payload, anna, new Date(T0.getTime() + 25 * 60_000 + 40_000)))
    const log = await logOf(annaEnrollment, 1)
    expect(log).toMatchObject({ minutes: 25, completed: false })
    expect(log?.timerStartedAt ?? null).toBeNull()

    const resumed = after(60)
    await ok(startTimer(payload, anna, 1, resumed))
    const reached = await ok(syncTimer(payload, anna, after(15, resumed)))
    expect(reached.completedNow).toHaveLength(1) // 25 + 15 = 40
    const stopped = await ok(stopTimer(payload, anna, after(16, resumed)))
    expect(stopped.state.slots[1]).toMatchObject({ minutes: 41, completed: true, startedAt: null })
  })

  it('3. a stop after 30–59 seconds adds one minute, after 10 seconds none', async () => {
    await ok(startTimer(payload, anna, 0, T0))
    await ok(stopTimer(payload, anna, new Date(T0.getTime() + 10_000)))
    expect((await logOf(annaEnrollment, 0))?.minutes).toBe(0)
    await ok(startTimer(payload, anna, 0, after(5)))
    await ok(stopTimer(payload, anna, new Date(after(5).getTime() + 31_000)))
    expect((await logOf(annaEnrollment, 0))?.minutes).toBe(1)
  })

  it('5. reopening later: the state is computed from timerStartedAt and completion is saved once', async () => {
    await ok(startTimer(payload, anna, 0, T0)) // minimum 20
    const view = await ok(getTimerState(payload, anna, after(30)))
    expect(view.state.slots[0]).toMatchObject({ completed: true, startedAt: T0.toISOString() })
    expect(view.state.serverNow).toBe(after(30).toISOString())
    expect(view.completedNow).toEqual([{ slotTypeId: anki.id, minutes: 20 }])
    const second = await ok(getTimerState(payload, anna, after(31)))
    expect(second.completedNow).toEqual([])
  })

  it('6. starting slot B stops and saves slot A first: one timer at a time', async () => {
    await ok(startTimer(payload, anna, 0, T0))
    const { state } = await ok(startTimer(payload, anna, 1, after(12)))
    expect(state.slots[0]).toMatchObject({ minutes: 12, startedAt: null })
    expect(state.slots[1]).toMatchObject({ startedAt: after(12).toISOString() })
    const running = (await logs(annaEnrollment)).filter((log) => log.timerStartedAt)
    expect(running).toHaveLength(1)
  })

  it('7. a timer over 240 minutes is stopped with 240 minutes added', async () => {
    await ok(startTimer(payload, anna, 1, T0))
    const { state, completedNow } = await ok(getTimerState(payload, anna, after(5 * 60)))
    expect(state.slots[1]).toMatchObject({ minutes: 240, completed: true, startedAt: null })
    expect(completedNow).toEqual([{ slotTypeId: series.id, minutes: 240 }])
    const log = await logOf(annaEnrollment, 1)
    expect(log).toMatchObject({ minutes: 240, completed: true })
    expect(log?.timerStartedAt ?? null).toBeNull()
  })

  it('7. a stop long after the cap also adds only 240 minutes', async () => {
    await ok(startTimer(payload, anna, 0, T0))
    await ok(stopTimer(payload, anna, after(24 * 60)))
    expect((await logOf(annaEnrollment, 0))?.minutes).toBe(240)
  })

  it('8. across midnight in the enrollment zone the minutes belong to the day it started', async () => {
    const lateEvening = new Date('2026-10-10T18:50:00.000Z') // 23:50 in Almaty
    await ok(startTimer(payload, anna, 0, lateEvening))
    const result = await ok(stopTimer(payload, anna, after(20, lateEvening))) // 00:10 on 11 Oct
    const all = await logs(annaEnrollment)
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ date: '2026-10-10T00:00:00.000Z', minutes: 20, completed: true })
    expect(result.state.carried).toBeNull() // 11 Oct is a rest day: nothing to show, nothing running
  })

  it('8. a timer still running after midnight is offered for stopping as carried over', async () => {
    const lateEvening = new Date('2026-10-10T18:50:00.000Z')
    await ok(startTimer(payload, anna, 0, lateEvening))
    const { state } = await ok(getTimerState(payload, anna, after(20, lateEvening)))
    expect(state.carried).toMatchObject({
      name: 'timer Anki',
      startedAt: lateEvening.toISOString(),
    })
    expect(state.slots.every((slot) => slot.startedAt === null)).toBe(true)
  })

  it('10. a double tap changes state once', async () => {
    await Promise.all([startTimer(payload, anna, 0, T0), startTimer(payload, anna, 0, T0)])
    expect(await logs(annaEnrollment)).toHaveLength(1)
    await Promise.all([stopTimer(payload, anna, after(7)), stopTimer(payload, anna, after(7))])
    const log = await logOf(annaEnrollment, 0)
    expect(log?.minutes).toBe(7)
    expect(log?.timerStartedAt ?? null).toBeNull()
    // A stop with nothing running is a no-op, not an error.
    await ok(stopTimer(payload, anna, after(9)))
    expect((await logOf(annaEnrollment, 0))?.minutes).toBe(7)
  })

  it('refuses a slot the day does not have, and a student without a started program', async () => {
    expect(await startTimer(payload, anna, 4, T0)).toEqual({ ok: false, error: 'invalid_slot' })
    expect(await startTimer(payload, anna, 2, T0)).toEqual({ ok: false, error: 'invalid_slot' })
    // Day 11 is template day 4: a rest day, nothing to time.
    expect(await startTimer(payload, anna, 0, after(24 * 60))).toEqual({
      ok: false,
      error: 'invalid_slot',
    })
    const carol = asUser(
      await quietly(() =>
        payload.create({
          collection: 'users',
          data: { email: 'timer-carol@example.com', role: 'student' },
        }),
      ),
    )
    try {
      expect(await startTimer(payload, carol, 0, T0)).toEqual({ ok: false, error: 'no_program' })
    } finally {
      await payload.delete({ collection: 'users', id: carol.id })
    }
  })

  it('11. a student cannot write logs through the API: other enrollment, future date or her own', async () => {
    const base = {
      date: '2026-10-10T00:00:00.000Z',
      slotIndex: 0,
      slotType: anki.id,
      minutes: 500,
      completed: true,
    }
    for (const data of [
      { ...base, enrollment: borisEnrollment.id }, // someone else's
      { ...base, enrollment: annaEnrollment.id, date: '2026-12-31T00:00:00.000Z' }, // future
      { ...base, enrollment: annaEnrollment.id }, // her own: minutes are the server's job
    ]) {
      await expect(
        payload.create({ collection: 'slot-logs', overrideAccess: false, user: anna, data }),
      ).rejects.toMatchObject({ status: 403 })
    }
    await ok(startTimer(payload, anna, 0, T0))
    const own = await logOf(annaEnrollment, 0)
    await expect(
      payload.update({
        collection: 'slot-logs',
        id: own!.id,
        overrideAccess: false,
        user: anna,
        data: { minutes: 600, completed: true },
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.delete({ collection: 'slot-logs', id: own!.id, overrideAccess: false, user: anna }),
    ).rejects.toMatchObject({ status: 403 })
    expect((await logOf(annaEnrollment, 0))?.minutes).toBe(0)
  })

  it('11. a student reads only her own logs; the owner reads all; strangers nothing', async () => {
    await ok(startTimer(payload, anna, 0, T0))
    await ok(startTimer(payload, boris, 0, T0))
    const read = async (user: TypedUser | undefined) =>
      (
        await payload.find({
          collection: 'slot-logs',
          overrideAccess: false,
          user,
          pagination: false,
          depth: 0,
        })
      ).docs.map((log) => (typeof log.enrollment === 'object' ? log.enrollment.id : log.enrollment))
    expect(await read(anna)).toEqual([annaEnrollment.id])
    expect(await read(boris)).toEqual([borisEnrollment.id])
    expect((await read(owner)).sort()).toEqual([annaEnrollment.id, borisEnrollment.id].sort())
    await expect(read(undefined)).rejects.toMatchObject({ status: 403 })
  })

  it('there is one log per enrollment, date and slot', async () => {
    await ok(startTimer(payload, anna, 0, T0))
    const existing = await logOf(annaEnrollment, 0)
    await expect(
      payload.create({
        collection: 'slot-logs',
        data: {
          enrollment: annaEnrollment.id,
          date: existing!.date,
          slotIndex: 0,
          slotType: anki.id,
          minutes: 1,
          completed: false,
        },
      }),
    ).rejects.toThrow()
  })

  it('013 progress: logs now drive the day states and totals', async () => {
    await ok(startTimer(payload, anna, 0, T0))
    await ok(stopTimer(payload, anna, after(25))) // Anki 20: completed
    await ok(startTimer(payload, anna, 1, after(30)))
    await ok(stopTimer(payload, anna, after(55))) // Series 40: 25 min, not completed
    let view = await getStudyOverview(payload, anna, 'ru', after(60))
    if (view.kind !== 'ready') throw new Error('expected a started program')
    expect(view.progress.get(10)).toEqual({ done: false, minutes: 50 })

    await ok(startTimer(payload, anna, 1, after(70)))
    await ok(stopTimer(payload, anna, after(90))) // 25 + 20 = 45 ≥ 40
    view = await getStudyOverview(payload, anna, 'ru', after(95))
    if (view.kind !== 'ready') throw new Error('expected a started program')
    expect(view.progress.get(10)).toEqual({ done: true, minutes: 70 })
  })
})
