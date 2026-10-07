import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { summarize } from '@/features/challenge/progress'
import type { Challenge } from '@/payload-types'

let payload: Payload
let admin: TypedUser

const context = { disableRevalidate: true }

// Payload keeps the specific message in `data.errors`; `.message` only names the invalid fields.
async function expectInvalid(promise: Promise<unknown>, path: string, message: RegExp) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e as { data?: { errors?: { path: string; message: string }[] } },
  )
  if (!error) throw new Error('expected the write to be rejected')
  expect(error.data?.errors).toEqual([{ path, message: expect.stringMatching(message) }])
}
const videos = (count = 6) => Array.from({ length: count }, (_, i) => ({ title: `Topic ${i + 1}` }))

// Payload types fields with a default as required; the tests leave them out on purpose so the
// collection's own defaults (Asia/Almaty, 90 / 90 / 15) are what gets exercised.
const challengeData = (slug: string, extra: Partial<Challenge> = {}, videosCount = 6) =>
  ({
    title: `Challenge ${slug}`,
    slug,
    startDate: '2026-10-07T12:00:00.000Z',
    videos: videos(videosCount),
    ...extra,
  }) as Challenge

async function createChallenge(slug: string, extra: Partial<Challenge> = {}, videosCount = 6) {
  return payload.create({
    collection: 'challenges',
    context,
    overrideAccess: false,
    user: admin,
    data: challengeData(slug, extra, videosCount),
  })
}

async function cleanup() {
  await payload.delete({ collection: 'challenge-days', where: { id: { exists: true } }, context })
  await payload.delete({ collection: 'challenges', where: { id: { exists: true } }, context })
}

describe('challenges', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await cleanup()
    const user = await payload.create({
      collection: 'users',
      data: { email: 'challenge@example.com' },
    })
    admin = { ...user, collection: 'users' }
  })

  afterAll(async () => {
    await cleanup()
    await payload.delete({
      collection: 'users',
      where: { email: { equals: 'challenge@example.com' } },
    })
    await payload.destroy()
  })

  describe('data model', () => {
    it('saves a challenge with the defaults 90 / 90 / 15 and an 8 100-minute target', async () => {
      const created = await createChallenge('defaults')
      expect(created).toMatchObject({
        timeZone: 'Asia/Almaty',
        durationDays: 90,
        dailyMinutes: 90,
        blockDays: 15,
        isPublic: false,
      })
      expect(created.videos).toHaveLength(6)
      const summary = summarize(created, [], new Date('2026-10-08T00:00:00.000Z'))
      expect(summary.minutesTarget).toBe(8100)
    })

    it('rejects a durationDays that is not divisible by blockDays', async () => {
      await expectInvalid(
        createChallenge('not-divisible', { blockDays: 20 }),
        'blockDays',
        /divisible/i,
      )
    })

    it('rejects a videos count different from durationDays / blockDays', async () => {
      await expectInvalid(createChallenge('five-videos', {}, 5), 'videos', /exactly 6 videos/i)
    })

    it('re-checks the shape on update using the stored values', async () => {
      const created = await createChallenge('update-shape')
      const update = (data: Partial<Challenge>) =>
        payload.update({ collection: 'challenges', id: created.id, context, data })
      await expectInvalid(update({ blockDays: 20 }), 'blockDays', /divisible/i)
      await expectInvalid(update({ videos: videos(2) }), 'videos', /exactly 6 videos/i)
      await expect(update({ title: 'Renamed' })).resolves.toMatchObject({ title: 'Renamed' })
    })

    it('refuses to delete a challenge that has logged days, and to shrink it below them', async () => {
      const challenge = await createChallenge('with-days')
      await payload.create({
        collection: 'challenge-days',
        context,
        data: { challenge: challenge.id, dayNumber: 80, minutes: 90 },
      })
      await expect(
        payload.delete({ collection: 'challenges', id: challenge.id, context }),
      ).rejects.toThrow(/logged day/i)
      await expectInvalid(
        payload.update({
          collection: 'challenges',
          id: challenge.id,
          context,
          data: { durationDays: 60, videos: videos(4), blockDays: 15 },
        }),
        'durationDays',
        /beyond day 60/i,
      )
    })

    it('stores the start date as a calendar date regardless of the offset given', async () => {
      const created = await createChallenge('offset', { startDate: '2026-10-07T23:00:00-05:00' })
      expect(created.startDate).toBe('2026-10-07T12:00:00.000Z')
    })

    it('rejects an unknown time zone and a duplicate slug', async () => {
      await expect(createChallenge('bad-zone', { timeZone: 'Mars/Olympus' })).rejects.toThrow()
      await createChallenge('dup')
      await expect(createChallenge('dup')).rejects.toThrow()
    })
  })

  describe('access', () => {
    let publicChallenge: Awaited<ReturnType<typeof createChallenge>>
    let privateChallenge: Awaited<ReturnType<typeof createChallenge>>

    beforeAll(async () => {
      publicChallenge = await createChallenge('access-public', { isPublic: true })
      privateChallenge = await createChallenge('access-private', { isPublic: false })
      for (const challenge of [publicChallenge, privateChallenge]) {
        await payload.create({
          collection: 'challenge-days',
          context,
          data: {
            challenge: challenge.id,
            dayNumber: 1,
            minutes: 90,
            closedAt: new Date().toISOString(),
          },
        })
      }
    })

    it('lets anonymous readers see public challenges only', async () => {
      const { docs } = await payload.find({
        collection: 'challenges',
        overrideAccess: false,
        where: { slug: { like: 'access-' } },
      })
      expect(docs.map((d) => d.slug)).toEqual(['access-public'])
    })

    it('hides a non-public challenge from anonymous findByID', async () => {
      await expect(
        payload.findByID({
          collection: 'challenges',
          id: privateChallenge.id,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
      const found = await payload.findByID({
        collection: 'challenges',
        id: publicChallenge.id,
        overrideAccess: false,
      })
      expect(found.slug).toBe('access-public')
    })

    it('lets anonymous readers see days of public challenges only', async () => {
      const { docs } = await payload.find({
        collection: 'challenge-days',
        overrideAccess: false,
        depth: 0,
      })
      expect(docs.map((d) => d.challenge)).toEqual([publicChallenge.id])
    })

    it('shows everything to a signed-in admin', async () => {
      const challenges = await payload.find({
        collection: 'challenges',
        overrideAccess: false,
        user: admin,
        where: { slug: { like: 'access-' } },
      })
      expect(challenges.totalDocs).toBe(2)
      const days = await payload.find({
        collection: 'challenge-days',
        overrideAccess: false,
        user: admin,
        where: { challenge: { in: [publicChallenge.id, privateChallenge.id] } },
        depth: 0,
      })
      expect(days.totalDocs).toBe(2)
    })

    it('refuses anonymous writes on both collections', async () => {
      await expect(
        payload.create({
          collection: 'challenges',
          context,
          overrideAccess: false,
          data: challengeData('hijack'),
        }),
      ).rejects.toThrow()
      await expect(
        payload.update({
          collection: 'challenges',
          id: publicChallenge.id,
          context,
          overrideAccess: false,
          data: { isPublic: false },
        }),
      ).rejects.toThrow()
      await expect(
        payload.delete({
          collection: 'challenges',
          id: publicChallenge.id,
          context,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
      await expect(
        payload.create({
          collection: 'challenge-days',
          context,
          overrideAccess: false,
          data: { challenge: publicChallenge.id, dayNumber: 2, minutes: 90 },
        }),
      ).rejects.toThrow()
      await expect(
        payload.update({
          collection: 'challenge-days',
          where: { dayNumber: { equals: 1 } },
          context,
          overrideAccess: false,
          data: { minutes: 1 },
        }),
      ).rejects.toThrow()
      await expect(
        payload.delete({
          collection: 'challenge-days',
          where: { dayNumber: { equals: 1 } },
          context,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    })
  })

  describe('challenge days', () => {
    it('rejects a second row for the same challenge and day', async () => {
      const challenge = await createChallenge('unique-day')
      const data = { challenge: challenge.id, dayNumber: 3, minutes: 90 }
      await payload.create({ collection: 'challenge-days', context, data })
      await expectInvalid(
        payload.create({ collection: 'challenge-days', context, data }),
        'dayNumber',
        /already logged/i,
      )
      // The same day number in another challenge is fine.
      const other = await createChallenge('unique-day-other')
      await payload.create({
        collection: 'challenge-days',
        context,
        data: { ...data, challenge: other.id },
      })
    })

    it('rejects a day for a challenge that does not exist', async () => {
      await expectInvalid(
        payload.create({
          collection: 'challenge-days',
          context,
          data: { challenge: 999_999, dayNumber: 1, minutes: 90 },
        }),
        'challenge',
        /does not exist/i,
      )
    })

    it('keeps dayNumber within 1…durationDays and minutes within 1…600', async () => {
      const challenge = await createChallenge('day-bounds')
      const base = { challenge: challenge.id, dayNumber: 1, minutes: 90 }
      const create = (data: Partial<typeof base>) =>
        payload.create({ collection: 'challenge-days', context, data: { ...base, ...data } })
      await expect(create({ dayNumber: 0 })).rejects.toThrow()
      await expect(create({ dayNumber: 91 })).rejects.toThrow()
      await expect(create({ minutes: 0 })).rejects.toThrow()
      await expect(create({ minutes: 601 })).rejects.toThrow()
      await expect(create({ dayNumber: 2.5 })).rejects.toThrow()
      await create({ dayNumber: 90, minutes: 600 })
    })

    it('limits notes to 500 characters', async () => {
      const challenge = await createChallenge('notes-limit')
      await expect(
        payload.create({
          collection: 'challenge-days',
          context,
          data: { challenge: challenge.id, dayNumber: 1, minutes: 90, notes: 'x'.repeat(501) },
        }),
      ).rejects.toThrow()
    })
  })
})
