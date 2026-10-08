import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { closeDayAction } from '@/features/challenge/actions'
import { initialCloseDayState } from '@/features/challenge/schema'
import { closeDay } from '@/features/challenge/service'
import { issueToken, SESSION_COOKIE } from '@/features/auth/session'

const request = vi.hoisted(() => ({ headers: new Headers() }))
vi.mock('next/headers', () => ({
  headers: async () => request.headers,
  cookies: async () => ({ set: vi.fn() }),
}))
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }))
vi.mock('next/cache', () => cache)
const vercel = vi.hoisted(() => ({
  track: vi.fn(async (_event: string, _props?: object, _options?: object) => {}),
}))
vi.mock('@vercel/analytics/server', () => vercel)

const ADMIN_EMAIL = 'int-close-day-admin@example.com'
const SLUG = 'int-close-day'
const context = { disableRevalidate: true }
let payload: Payload
let challengeId: number
let adminId: number
let admin: TypedUser

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}
const submit = (fields: Record<string, string>) =>
  closeDayAction(initialCloseDayState, form({ slug: SLUG, minutes: '90', notes: '', ...fields }))

const signInAs = (userId: number | string) => {
  const { token } = issueToken(userId, payload.secret)
  request.headers = new Headers({ cookie: `${SESSION_COOKIE}=${token}` })
}
const signedOut = () => {
  request.headers = new Headers()
}

const rows = async () =>
  (
    await payload.find({
      collection: 'challenge-days',
      where: { challenge: { equals: challengeId } },
      sort: 'dayNumber',
      depth: 0,
      limit: 200,
    })
  ).docs

// Day 16 in Asia/Almaty: the challenge started 15 days ago, counted by the Almaty calendar
// (a UTC date is a day behind there from 19:00 UTC on).
const startDate = () =>
  new Date(Date.now() - 15 * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' })

describe('close a day', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await payload.delete({ collection: 'users', where: { email: { equals: ADMIN_EMAIL } } })
    const created = await payload.create({
      collection: 'users',
      data: { email: ADMIN_EMAIL, role: 'owner' },
    })
    adminId = created.id
    admin = { ...created, collection: 'users' }
    const old = await payload.find({ collection: 'challenges', where: { slug: { equals: SLUG } } })
    for (const doc of old.docs) {
      await payload.delete({
        collection: 'challenge-days',
        where: { challenge: { equals: doc.id } },
        context,
      })
      await payload.delete({ collection: 'challenges', id: doc.id, context })
    }
    const challenge = await payload.create({
      collection: 'challenges',
      locale: 'en',
      context,
      data: {
        slug: SLUG,
        title: 'Int close day',
        startDate: startDate(),
        timeZone: 'Asia/Almaty',
        durationDays: 90,
        dailyMinutes: 90,
        blockDays: 15,
        isPublic: false,
        videos: Array.from({ length: 6 }, (_, i) => ({ title: `Topic ${i + 1}` })),
      },
    })
    challengeId = challenge.id
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubEnv('SENTRY_DSN', '')
    vi.stubEnv('ANALYTICS_PROVIDER', 'vercel')
    await payload.delete({
      collection: 'challenge-days',
      where: { challenge: { equals: challengeId } },
      context,
    })
    signInAs(adminId)
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await payload.delete({
      collection: 'challenge-days',
      where: { challenge: { equals: challengeId } },
      context,
    })
    await payload.delete({ collection: 'challenges', id: challengeId, context })
    await payload.delete({ collection: 'users', where: { email: { equals: ADMIN_EMAIL } } })
    await payload.destroy()
  })

  describe('signed in', () => {
    it('closes today with minutes and notes (criterion 2)', async () => {
      const state = await submit({ dayNumber: '16', minutes: '90', notes: 'Planned the lesson' })

      expect(state).toEqual({ status: 'success', dayNumber: 16, updated: false })
      const [day] = await rows()
      expect(day).toMatchObject({ dayNumber: 16, minutes: 90, notes: 'Planned the lesson' })
      expect(day?.closedAt).toBeTruthy()
    })

    it('backfills a forgotten past day (criterion 3)', async () => {
      const state = await submit({ dayNumber: '3', minutes: '45' })

      expect(state).toMatchObject({ status: 'success', dayNumber: 3 })
      expect((await rows()).map((d) => [d.dayNumber, d.minutes])).toEqual([[3, 45]])
    })

    it('updates an already closed day instead of duplicating it (criterion 4)', async () => {
      await submit({ dayNumber: '5', minutes: '60', notes: 'first' })
      const [before] = await rows()

      const state = await submit({ dayNumber: '5', minutes: '120', notes: 'second' })

      expect(state).toEqual({ status: 'success', dayNumber: 5, updated: true })
      const after = await rows()
      expect(after).toHaveLength(1)
      expect(after[0]).toMatchObject({ id: before?.id, minutes: 120, notes: 'second' })
      expect(after[0]?.closedAt).toBe(before?.closedAt)
    })

    it('clears the notes when the form is saved without them', async () => {
      await submit({ dayNumber: '5', notes: 'something' })
      await submit({ dayNumber: '5', notes: '' })
      expect((await rows())[0]?.notes ?? '').toBe('')
    })

    it('creates exactly one entry for a double submit (criterion 8)', async () => {
      const results = await Promise.all([
        submit({ dayNumber: '7', minutes: '90' }),
        submit({ dayNumber: '7', minutes: '90' }),
        submit({ dayNumber: '7', minutes: '90' }),
      ])

      expect(results.every((r) => r.status === 'success')).toBe(true)
      expect(await rows()).toHaveLength(1)
    })

    it('refuses a future day with a code (criterion 5)', async () => {
      expect(await submit({ dayNumber: '17' })).toEqual({ status: 'error', error: 'future_day' })
      expect(await submit({ dayNumber: '90' })).toEqual({ status: 'error', error: 'future_day' })
      expect(await rows()).toEqual([])
    })

    it.each(['0', '-3', '91', '1000', '2.5', 'abc', ''])(
      'refuses day %j with a code and saves nothing (criterion 5)',
      async (dayNumber) => {
        const state = await submit({ dayNumber })
        expect(state.status).toBe('error')
        expect(state).toEqual({ status: 'error', error: expect.stringMatching(/^invalid_/) })
        expect(await rows()).toEqual([])
      },
    )

    it('refuses day 91 of a 90-day challenge even though the schema allows up to 365', async () => {
      expect(await submit({ dayNumber: '91' })).toEqual({ status: 'error', error: 'invalid_day' })
    })

    it('returns translated-validation codes for bad minutes and notes (criterion 6)', async () => {
      expect(await submit({ dayNumber: '2', minutes: '0' })).toEqual({
        status: 'error',
        error: 'invalid_minutes',
      })
      expect(await submit({ dayNumber: '2', minutes: '601' })).toEqual({
        status: 'error',
        error: 'invalid_minutes',
      })
      expect(await submit({ dayNumber: '2', notes: 'a'.repeat(501) })).toEqual({
        status: 'error',
        error: 'invalid_notes',
      })
      expect(await rows()).toEqual([])
    })

    it('answers not_found for an unknown slug', async () => {
      expect(await submit({ dayNumber: '2', slug: 'nope' })).toEqual({
        status: 'error',
        error: 'not_found',
      })
    })

    it('refuses every day of a challenge that has not started', async () => {
      const result = await closeDay(
        payload,
        admin,
        { slug: SLUG, dayNumber: 1, minutes: 90 },
        new Date(Date.now() - 30 * 86_400_000),
      )
      expect(result).toEqual({ ok: false, error: 'future_day' })
    })

    it('flips to the next day at local midnight, not at UTC midnight', async () => {
      // 2026-10-07 18:30 UTC is 23:30 in Astana: day 1 of a challenge starting on the 7th.
      await payload.update({
        collection: 'challenges',
        id: challengeId,
        context,
        data: { startDate: '2026-10-07' },
      })
      const user = admin
      const input = { slug: SLUG, minutes: 90 }
      try {
        const at = (iso: string) => new Date(iso)
        expect(
          await closeDay(payload, user, { ...input, dayNumber: 2 }, at('2026-10-07T18:30:00Z')),
        ).toEqual({ ok: false, error: 'future_day' })
        expect(
          await closeDay(payload, user, { ...input, dayNumber: 2 }, at('2026-10-07T19:10:00Z')),
        ).toMatchObject({ ok: true })
      } finally {
        await payload.update({
          collection: 'challenges',
          id: challengeId,
          context,
          data: { startDate: startDate() },
        })
      }
    })
  })

  describe('forged calls: the server decides, not the UI (criterion 7)', () => {
    const forged = { dayNumber: '2', minutes: '90', notes: 'forged' }

    it('refuses a request without a session cookie', async () => {
      signedOut()
      expect(await submit(forged)).toEqual({ status: 'error', error: 'unauthorized' })
      expect(await rows()).toEqual([])
      expect(vercel.track).not.toHaveBeenCalled()
    })

    it('refuses a cookie with a forged signature', async () => {
      const { token } = issueToken(adminId, 'some-other-secret')
      request.headers = new Headers({ cookie: `${SESSION_COOKIE}=${token}` })
      expect(await submit(forged)).toEqual({ status: 'error', error: 'unauthorized' })
      expect(await rows()).toEqual([])
    })

    it('refuses a hand-made cookie for an existing user id', async () => {
      request.headers = new Headers({ cookie: `${SESSION_COOKIE}=${adminId}.9999999999.deadbeef` })
      expect(await submit(forged)).toEqual({ status: 'error', error: 'unauthorized' })
    })

    it('refuses an expired session', async () => {
      const { token } = issueToken(adminId, payload.secret, Date.now() - 30 * 86_400_000)
      request.headers = new Headers({ cookie: `${SESSION_COOKIE}=${token}` })
      expect(await submit(forged)).toEqual({ status: 'error', error: 'unauthorized' })
      expect(await rows()).toEqual([])
    })

    it('refuses a valid session of a user that no longer exists', async () => {
      const ghost = await payload.create({
        collection: 'users',
        data: { email: 'ghost-close-day@example.com', role: 'owner' },
      })
      signInAs(ghost.id)
      await payload.delete({ collection: 'users', id: ghost.id })
      expect(await submit(forged)).toEqual({ status: 'error', error: 'unauthorized' })
      expect(await rows()).toEqual([])
    })

    it('does not accept the session as a bearer header or a user-controlled field', async () => {
      request.headers = new Headers({
        authorization: `JWT ${issueToken(adminId, payload.secret).token}`,
      })
      expect(await submit({ ...forged, user: String(adminId) })).toEqual({
        status: 'error',
        error: 'unauthorized',
      })
    })

    it('checks the session before it validates anything', async () => {
      signedOut()
      expect(await submit({ dayNumber: 'abc', minutes: '-1' })).toEqual({
        status: 'error',
        error: 'unauthorized',
      })
    })

    it('cannot write through the service without a user either', async () => {
      const result = await closeDay(payload, null as never, {
        slug: SLUG,
        dayNumber: 2,
        minutes: 90,
      }).catch(() => 'threw')
      expect(result === 'threw' || (typeof result === 'object' && result.ok === false)).toBe(true)
      expect(await rows()).toEqual([])
    })
  })

  describe('side effects', () => {
    it('tracks challenge_day_closed without personal data (criterion 9)', async () => {
      await submit({ dayNumber: '4', notes: 'private note about my life' })
      await submit({ dayNumber: '4', notes: 'again' })

      expect(vercel.track.mock.calls.map(([event, props]) => ({ event, props }))).toEqual([
        { event: 'challenge_day_closed', props: { updated: false } },
        { event: 'challenge_day_closed', props: { updated: true } },
      ])
      const sent = JSON.stringify(vercel.track.mock.calls)
      expect(sent).not.toContain(ADMIN_EMAIL)
      expect(sent).not.toContain('private note')
    })

    it('does not track a refused call', async () => {
      await submit({ dayNumber: '99' })
      signedOut()
      await submit({ dayNumber: '2' })
      expect(vercel.track).not.toHaveBeenCalled()
    })

    it('revalidates the concrete per-locale page paths after a save', async () => {
      await submit({ dayNumber: '4' })
      expect(cache.revalidatePath.mock.calls.map(([path]) => path).sort()).toEqual([
        `/en/challenge/${SLUG}`,
        `/ru/challenge/${SLUG}`,
      ])
    })
  })
})
