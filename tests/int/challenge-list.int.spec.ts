import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { listPublicChallenges } from '@/features/challenge/queries'
import type { Challenge } from '@/payload-types'

let payload: Payload
const context = { disableRevalidate: true }
const videos = Array.from({ length: 6 }, (_, i) => ({ title: `Topic ${i + 1}` }))

const make = (slug: string, startDate: string, isPublic: boolean) =>
  payload.create({
    collection: 'challenges',
    context,
    data: { title: slug, slug, startDate, isPublic, videos } as Challenge,
  })

async function cleanup() {
  await payload.delete({ collection: 'challenge-days', where: { id: { exists: true } }, context })
  await payload.delete({ collection: 'challenges', where: { id: { exists: true } }, context })
}

beforeAll(async () => {
  payload = await getPayload({ config })
  await cleanup()
})
afterAll(cleanup)

describe('listPublicChallenges', () => {
  it('lists public challenges newest first with a summary, and hides private ones', async () => {
    const older = await make('older', '2026-01-01T12:00:00.000Z', true)
    await make('newer', '2026-06-01T12:00:00.000Z', true)
    await make('hidden', '2026-09-01T12:00:00.000Z', false)
    await payload.create({
      collection: 'challenge-days',
      context,
      data: {
        challenge: older.id,
        dayNumber: 1,
        minutes: 90,
        closedAt: '2026-01-01T15:00:00.000Z',
      },
    })

    const items = await listPublicChallenges(payload, 'en', new Date('2026-06-02T00:00:00Z'))

    expect(items.map((item) => item.slug)).toEqual(['newer', 'older'])
    expect(items[1]!.summary.minutesDone).toBe(90)
    expect(items[0]!.summary.minutesDone).toBe(0)
  })
})
