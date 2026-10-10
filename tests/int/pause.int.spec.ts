import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { pauseProgramAction, resumeProgramAction } from '@/features/program-pause/actions'
import { pauseProgram, resumeProgram } from '@/features/program-pause/service'
import { getStudyView } from '@/features/enrollments/queries'
import { saveDayComment } from '@/features/day-comments/service'
import { getTimerState, markSlot, startTimer } from '@/features/slot-timer/service'
import { getStudyOverview } from '@/features/study-today/queries'
import { todayIn } from '@/features/enrollments/shape'
import type { Enrollment, Program, SlotLog, SlotType } from '@/payload-types'

// The signed-in student of the Server Actions is whoever `current` points to.
const session = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/features/auth/current-user', () => ({ currentStudent: async () => session.current }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': 'int-test' }) }))
const vercel = vi.hoisted(() => ({
  track: vi.fn(async (_event: string, _props?: object, _options?: object) => {}),
}))
vi.mock('@vercel/analytics/server', () => vercel)

let payload: Payload
let owner: TypedUser
let anna: TypedUser
let boris: TypedUser
let program: Program
let short: Program
let sparse: Program
let anki: SlotType

const context = { disableRevalidate: true }
const emails = {
  owner: 'pause-owner@example.com',
  anna: 'pause-anna@example.com',
  boris: 'pause-boris@example.com',
}
const slugs = { main: 'pause-main', short: 'pause-short', sparse: 'pause-sparse' }

// Day 1 is 2026-10-01 in Almaty (UTC+5). 10:00 on 2026-10-20 is program day 20.
const START = '2026-10-01'
const DAY20 = new Date('2026-10-20T05:00:00.000Z')
const later = (days: number, from = DAY20) => new Date(from.getTime() + days * 86_400_000)

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

type StoredPause = { from: string; to?: string | null }

async function enroll(
  student: TypedUser,
  forProgram: Program,
  options: { startDate?: string; status?: string; pauses?: StoredPause[] } = {},
): Promise<Enrollment> {
  const enrollment = (await quietly(() =>
    payload.create({
      collection: 'enrollments',
      overrideAccess: false,
      user: owner,
      data: { student: student.id as number, program: forProgram.id, placement } as never,
    }),
  )) as Enrollment
  await payload.db.updateOne({
    collection: 'enrollments',
    id: enrollment.id,
    data: {
      status: options.status ?? 'active',
      timezone: 'Asia/Almaty',
      startDate: `${options.startDate ?? START}T00:00:00.000Z`,
    },
  })
  if (options.pauses) {
    // Arrays do not go through the adapter's bare update; the owner path of the collection takes them.
    await payload.update({
      collection: 'enrollments',
      id: enrollment.id,
      data: {
        pauses: options.pauses.map(({ from, to }) => ({
          from: `${from}T00:00:00.000Z`,
          to: to ? `${to}T00:00:00.000Z` : null,
        })),
      } as never,
      depth: 0,
      context,
    })
  }
  return enrollment
}

const reload = (id: number) => payload.findByID({ collection: 'enrollments', id, depth: 0 })
const dates = (enrollment: Enrollment) =>
  (enrollment.pauses ?? []).map((pause) => [
    pause.from.slice(0, 10),
    pause.to?.slice(0, 10) ?? null,
  ])

async function ok<T extends { ok: boolean }>(promise: Promise<T>) {
  const result = await promise
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`)
  return result as Extract<T, { ok: true }>
}

async function reset() {
  await payload.delete({
    collection: 'slot-logs',
    where: { 'enrollment.program.slug': { in: Object.values(slugs) } },
  })
  await payload.delete({
    collection: 'day-comments',
    where: { 'enrollment.program.slug': { in: Object.values(slugs) } },
  })
  await payload.delete({
    collection: 'enrollments',
    where: { 'program.slug': { in: Object.values(slugs) } },
  })
}

async function cleanup() {
  await reset()
  await payload.delete({
    collection: 'programs',
    where: { slug: { in: Object.values(slugs) } },
    context,
  })
  await payload.delete({ collection: 'slot-types', where: { name: { like: 'pause ' } }, context })
  await payload.delete({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    context,
  })
}

describe('pause and resume (story 017)', () => {
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
      data: { name: 'pause Anki', defaultMinMinutes: 20 },
    })
    const everyDay = Array.from({ length: 7 }, () => ({ slots: [{ slotType: anki.id }] }))
    const make = (slug: string, durationWeeks: number, week = everyDay) =>
      payload.create({
        collection: 'programs',
        context,
        data: {
          slug,
          title: slug,
          levelFrom: 'B1',
          levelTo: 'B2',
          durationWeeks,
          status: 'published',
          weekTemplate: week,
        } as never,
      }) as Promise<Program>
    program = await make(slugs.main, 52)
    short = await make(slugs.short, 1)
    // Only template day 1 has a slot: days 1, 8, 15, 22 …
    sparse = await make(slugs.sparse, 52, [
      { slots: [{ slotType: anki.id }] },
      ...Array.from({ length: 6 }, () => ({ slots: [] })),
    ])
  })

  beforeEach(async () => {
    await reset()
    vi.clearAllMocks()
    session.current = null
  })

  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  describe('pausing', () => {
    it('1. a pause starts today: status paused, the program day stays, /study has what it needs', async () => {
      const enrollment = await enroll(anna, program)
      const result = await ok(pauseProgram(payload, anna, DAY20))
      expect(result).toMatchObject({ changed: true, programSlug: slugs.main })

      const stored = await reload(enrollment.id)
      expect(stored.status).toBe('paused')
      expect(dates(stored)).toEqual([['2026-10-20', null]])

      // Days later she is still on day 20 of 364.
      const view = await getStudyOverview(payload, anna, 'ru', later(3))
      expect(view).toMatchObject({
        kind: 'ready',
        status: 'paused',
        today: 20,
        totalDays: 364,
        pausedSince: '2026-10-20',
      })
    })

    it('a second tap changes nothing and adds no second pause', async () => {
      const enrollment = await enroll(anna, program)
      await ok(pauseProgram(payload, anna, DAY20))
      expect(await ok(pauseProgram(payload, anna, later(1)))).toMatchObject({ changed: false })
      expect(dates(await reload(enrollment.id))).toEqual([['2026-10-20', null]])
    })

    it('two taps at once leave one pause and no error', async () => {
      const enrollment = await enroll(anna, program)
      const results = await Promise.all([
        pauseProgram(payload, anna, DAY20),
        pauseProgram(payload, anna, DAY20),
      ])
      expect(results.every((r) => r.ok)).toBe(true)
      expect(dates(await reload(enrollment.id))).toEqual([['2026-10-20', null]])
    })

    it('5. a running timer is stopped and saved first', async () => {
      const enrollment = await enroll(anna, program)
      await ok(startTimer(payload, anna, 0, DAY20))
      await ok(pauseProgram(payload, anna, new Date(DAY20.getTime() + 5 * 60_000)))
      const { docs } = await payload.find({
        collection: 'slot-logs',
        where: { enrollment: { equals: enrollment.id } },
        depth: 0,
      })
      const log = docs[0] as SlotLog
      expect(log.timerStartedAt).toBeNull()
      expect(log.minutes).toBe(5)
    })

    it('7. a paused program starts no timer and shows no slots to run', async () => {
      await enroll(anna, program)
      await ok(pauseProgram(payload, anna, DAY20))
      expect(await startTimer(payload, anna, 0, later(1))).toEqual({ ok: false, error: 'paused' })
      const state = await ok(getTimerState(payload, anna, later(1)))
      expect(state.state.slots).toEqual([])
    })

    it('a program that is over cannot be paused', async () => {
      await enroll(anna, short, { startDate: '2026-09-01' })
      expect(await pauseProgram(payload, anna, DAY20)).toEqual({ ok: false, error: 'program_over' })
    })

    it('is the signed-in student’s own program: another student has none to pause', async () => {
      const enrollment = await enroll(anna, program)
      expect(await pauseProgram(payload, boris, DAY20)).toEqual({ ok: false, error: 'no_program' })
      expect((await reload(enrollment.id)).status).toBe('active')
    })
  })

  describe('resuming', () => {
    it('2. a pause of 5 days ends yesterday and today is program day 20 again', async () => {
      const enrollment = await enroll(anna, program)
      await ok(pauseProgram(payload, anna, DAY20))
      const back = later(5)
      await ok(resumeProgram(payload, anna, back))

      const stored = await reload(enrollment.id)
      expect(stored.status).toBe('active')
      expect(dates(stored)).toEqual([['2026-10-20', '2026-10-24']])
      expect(await getStudyOverview(payload, anna, 'ru', back)).toMatchObject({
        status: 'active',
        today: 20,
      })
      expect(await getStudyOverview(payload, anna, 'ru', later(6))).toMatchObject({ today: 21 })
    })

    it('4. any length, any number of earlier pauses: 200 days resume normally', async () => {
      const enrollment = await enroll(anna, program, {
        pauses: [
          { from: '2026-10-03', to: '2026-10-04' },
          { from: '2026-10-08', to: '2026-10-09' },
          { from: '2026-10-12', to: '2026-10-12' },
        ],
      })
      // Three earlier pauses: 2 + 2 + 1 days. Day 20 on the calendar is day 15 today.
      expect(await getStudyOverview(payload, anna, 'ru', DAY20)).toMatchObject({ today: 15 })

      await ok(pauseProgram(payload, anna, DAY20))
      const back = later(200)
      await ok(resumeProgram(payload, anna, back))

      const stored = await reload(enrollment.id)
      expect(stored.status).toBe('active')
      expect(dates(stored).at(-1)).toEqual(['2026-10-20', '2027-05-07'])
      expect(dates(stored)).toHaveLength(4)
      expect(await getStudyOverview(payload, anna, 'ru', back)).toMatchObject({
        status: 'active',
        today: 15,
      })
    })

    it('6. pause and resume on the same day leave no record and the day counts normally', async () => {
      const enrollment = await enroll(anna, program)
      await ok(pauseProgram(payload, anna, DAY20))
      await ok(resumeProgram(payload, anna, later(0.1)))
      const stored = await reload(enrollment.id)
      expect(stored.status).toBe('active')
      expect(stored.pauses ?? []).toEqual([])
      expect(await getStudyOverview(payload, anna, 'ru', later(1))).toMatchObject({ today: 21 })
    })

    it('an earlier pause stays when a later one is begun and ended on the same day', async () => {
      const enrollment = await enroll(anna, program, {
        pauses: [{ from: '2026-10-03', to: '2026-10-04' }],
      })
      await ok(pauseProgram(payload, anna, DAY20))
      await ok(resumeProgram(payload, anna, later(0.1)))
      expect(dates(await reload(enrollment.id))).toEqual([['2026-10-03', '2026-10-04']])
    })

    it('resuming a program that is not paused is refused, and two taps at once end in the same state', async () => {
      const enrollment = await enroll(anna, program)
      expect(await resumeProgram(payload, anna, DAY20)).toEqual({ ok: false, error: 'not_paused' })
      await ok(pauseProgram(payload, anna, DAY20))
      const results = await Promise.all([
        resumeProgram(payload, anna, later(3)),
        resumeProgram(payload, anna, later(3)),
      ])
      expect(results.every((r) => r.ok)).toBe(true)
      expect((await reload(enrollment.id)).status).toBe('active')
    })
  })

  describe('the program day under pauses (requirement 1)', () => {
    it('the student’s start card and views read the pause-aware day', async () => {
      await enroll(anna, program, { pauses: [{ from: '2026-10-05', to: '2026-10-07' }] })
      // Without the pause the calendar day today would be larger than the program day.
      // The enrollment's own time zone decides when the calendar day turns over.
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date())
      const calendar =
        (Date.parse(`${today}T00:00:00.000Z`) - Date.parse(`${START}T00:00:00.000Z`)) / 86_400_000 +
        1
      const view = await getStudyView(payload, anna, 'ru')
      expect(view.kind).toBe('active')
      if (view.kind === 'active') expect(view.day).toBe(calendar - 3)
    })

    it('the slot timer offers the slots of the pause-aware day', async () => {
      // Oct 20 is calendar day 20, but after five paused days it is program day 15 = template day 1.
      await enroll(anna, sparse, { pauses: [{ from: '2026-10-05', to: '2026-10-09' }] })
      const state = await ok(getTimerState(payload, anna, DAY20))
      expect(state.state.slots).toHaveLength(1)
      // Without the pause, day 20 is template day 6: a rest day.
      await reset()
      await enroll(anna, sparse)
      expect((await ok(getTimerState(payload, anna, DAY20))).state.slots).toHaveLength(0)
    })
  })

  describe('marking under pauses (requirement 3)', () => {
    const pauses = [{ from: '2026-10-05', to: '2026-10-09' }] // five paused days

    it('a program day after a pause is stored on its own calendar date, never on a paused one', async () => {
      const enrollment = await enroll(anna, program, { pauses })
      // Oct 20 is program day 15. Day 6 was studied on Oct 11, the first day after the pause.
      await ok(markSlot(payload, anna, { programDay: 6, slotIndex: 0, minutes: 25 }, DAY20))
      const { docs } = await payload.find({
        collection: 'slot-logs',
        where: { enrollment: { equals: enrollment.id } },
        depth: 0,
      })
      expect(docs.map((log) => log.date.slice(0, 10))).toEqual(['2026-10-11'])
      const view = await getStudyOverview(payload, anna, 'ru', DAY20)
      if (view.kind !== 'ready') throw new Error('expected a started program')
      expect(view.progress.get(6)).toEqual({ done: true, minutes: 25 })
      expect(view.progress.has(11)).toBe(false)
    })

    it('days after today are refused by the pause-aware day, not the calendar', async () => {
      await enroll(anna, program, { pauses })
      expect(
        await markSlot(payload, anna, { programDay: 16, slotIndex: 0, minutes: 25 }, DAY20),
      ).toEqual({
        ok: false,
        error: 'forbidden',
      })
      expect(
        await markSlot(payload, anna, { programDay: 15, slotIndex: 0, minutes: 25 }, DAY20),
      ).toMatchObject({
        ok: true,
      })
    })

    it('a paused program marks nothing', async () => {
      await enroll(anna, program, { pauses })
      await ok(pauseProgram(payload, anna, DAY20))
      expect(
        await markSlot(payload, anna, { programDay: 3, slotIndex: 0, minutes: 25 }, later(1)),
      ).toEqual({
        ok: false,
        error: 'paused',
      })
    })
  })

  describe('finishing (requirement 2)', () => {
    it('a paused program is never closed, however long the calendar has run on', async () => {
      const enrollment = await enroll(anna, short, {
        status: 'paused',
        pauses: [{ from: '2026-10-05' }], // paused on day 5 of 7
      })
      const view = await getStudyOverview(payload, anna, 'ru', later(100))
      expect(view).toMatchObject({ kind: 'ready', status: 'paused', today: 5 })
      expect((await reload(enrollment.id)).status).toBe('paused')
    })

    it('an active program with an ended pause is closed by the pause-aware day, not the calendar', async () => {
      const enrollment = await enroll(anna, short, {
        pauses: [{ from: '2026-10-05', to: '2026-10-17' }], // 13 paused days
      })
      // Oct 20: 19 − 13 + 1 = day 7, the last one: still open.
      expect(await getStudyOverview(payload, anna, 'ru', DAY20)).toMatchObject({
        status: 'active',
        today: 7,
      })
      expect((await reload(enrollment.id)).status).toBe('active')
      // Oct 21 is day 8: finished.
      expect(await getStudyOverview(payload, anna, 'ru', later(1))).toMatchObject({
        status: 'finished',
        today: 8,
      })
      expect((await reload(enrollment.id)).status).toBe('finished')
    })

    it('a pause on the last day: day 7 is today again after it, the program ends a day later', async () => {
      await enroll(anna, short, {
        startDate: '2026-10-14',
        status: 'paused',
        pauses: [{ from: '2026-10-20' }],
      })
      expect(await getStudyOverview(payload, anna, 'ru', later(30))).toMatchObject({
        status: 'paused',
        today: 7,
      })
      const back = later(30)
      await ok(resumeProgram(payload, anna, back))
      expect(await getStudyOverview(payload, anna, 'ru', back)).toMatchObject({
        status: 'active',
        today: 7,
      })
      expect(await getStudyOverview(payload, anna, 'ru', later(1, back))).toMatchObject({
        status: 'finished',
      })
    })
  })

  describe('days inside a pause (requirement 3)', () => {
    it('a comment on a paused calendar day is refused, the day around it is not', async () => {
      await enroll(anna, program, { pauses: [{ from: '2026-10-05', to: '2026-10-07' }] })
      for (const date of ['2026-10-05', '2026-10-06', '2026-10-07']) {
        expect(await saveDayComment(payload, anna, { date, text: 'hi' }, DAY20)).toEqual({
          ok: false,
          error: 'paused_day',
        })
      }
      for (const date of ['2026-10-04', '2026-10-08']) {
        expect(await saveDayComment(payload, anna, { date, text: 'hi' }, DAY20)).toMatchObject({
          ok: true,
        })
      }
    })

    it('a comment is refused while she is paused today', async () => {
      await enroll(anna, program)
      await ok(pauseProgram(payload, anna, DAY20))
      expect(
        await saveDayComment(payload, anna, { date: '2026-10-20', text: 'hi' }, DAY20),
      ).toEqual({
        ok: false,
        error: 'paused_day',
      })
    })
  })

  describe('only the student, only through the server (requirement 4)', () => {
    const rejected = async (id: number, data: object, user: TypedUser = anna) => {
      await expect(
        payload.update({
          collection: 'enrollments',
          id,
          data: data as never,
          overrideAccess: false,
          user,
        }),
      ).rejects.toThrow()
    }

    it('a student cannot write pauses or the status of her own enrollment over the API (403)', async () => {
      const enrollment = await enroll(anna, program)
      await rejected(enrollment.id, { pauses: [{ from: '2026-10-05T00:00:00.000Z', to: null }] })
      await rejected(enrollment.id, { status: 'paused' })
      await rejected(enrollment.id, {
        status: 'paused',
        pauses: [{ from: '2026-10-20T00:00:00.000Z', to: null }],
      })
      const stored = await reload(enrollment.id)
      expect(stored.status).toBe('active')
      expect(stored.pauses ?? []).toEqual([])
    })

    it('nor can she edit or remove the pauses of a paused enrollment', async () => {
      const enrollment = await enroll(anna, program, {
        status: 'paused',
        pauses: [{ from: '2026-10-05' }],
      })
      await rejected(enrollment.id, { status: 'active' })
      await rejected(enrollment.id, { status: 'active', pauses: [] })
      await rejected(enrollment.id, { pauses: [] })
      expect(dates(await reload(enrollment.id))).toEqual([['2026-10-05', null]])
    })

    it('nor another student’s enrollment', async () => {
      const enrollment = await enroll(anna, program)
      await rejected(enrollment.id, { status: 'paused' }, boris)
      expect((await reload(enrollment.id)).status).toBe('active')
    })

    it('the trusted transition accepts only status and pauses, and only active ⇄ paused', async () => {
      const enrollment = await enroll(anna, program)
      const update = (data: object) =>
        payload.update({
          collection: 'enrollments',
          id: enrollment.id,
          data: data as never,
          overrideAccess: true,
          context: { pauseTransition: true, disableRevalidate: true },
        })
      await expect(update({ status: 'paused', timezone: 'UTC' })).rejects.toThrow()
      await expect(update({ status: 'finished' })).rejects.toThrow()
      await expect(update({ status: 'active' })).rejects.toThrow() // active → active
      await expect(update({ startDate: '2020-01-01T00:00:00.000Z' })).rejects.toThrow()
      expect((await reload(enrollment.id)).timezone).toBe('Asia/Almaty')
    })

    it('without the transition flag the owner still cannot pause for a student', async () => {
      const enrollment = await enroll(anna, program)
      await rejected(enrollment.id, { status: 'paused' }, owner)
    })

    it('the actions take nothing from the browser', async () => {
      session.current = anna
      expect(await pauseProgramAction({ enrollment: 1 })).toEqual({
        status: 'error',
        error: 'invalid_input',
      })
      expect(await resumeProgramAction({ student: boris.id })).toEqual({
        status: 'error',
        error: 'invalid_input',
      })
    })

    it('the actions refuse a visitor who is not signed in', async () => {
      expect(await pauseProgramAction({})).toEqual({ status: 'error', error: 'unauthorized' })
      expect(await resumeProgramAction({})).toEqual({ status: 'error', error: 'unauthorized' })
    })
  })

  describe('analytics', () => {
    const sent = () => vercel.track.mock.calls.map(([event, props]) => ({ event, props }))
    beforeEach(() => {
      vi.stubEnv('ANALYTICS_PROVIDER', 'vercel')
      vi.stubEnv('SENTRY_DSN', '')
    })

    it('counts program_paused and program_resumed with the program slug only', async () => {
      const startDate = todayIn('Asia/Almaty', new Date(Date.now() - 19 * 86_400_000))
      await enroll(anna, program, { startDate })
      session.current = anna
      expect(await pauseProgramAction({})).toEqual({ status: 'success' })
      expect(await resumeProgramAction({})).toEqual({ status: 'success' })
      expect(sent()).toEqual([
        { event: 'program_paused', props: { programSlug: slugs.main } },
        { event: 'program_resumed', props: { programSlug: slugs.main } },
      ])
    })

    it('a repeated tap and a refused call count nothing', async () => {
      const startDate = todayIn('Asia/Almaty', new Date(Date.now() - 19 * 86_400_000))
      await enroll(anna, program, { startDate })
      session.current = anna
      await resumeProgramAction({}) // not paused: refused
      await pauseProgramAction({})
      await pauseProgramAction({}) // already paused: nothing changed
      expect(sent()).toEqual([{ event: 'program_paused', props: { programSlug: slugs.main } }])
    })
  })
})
