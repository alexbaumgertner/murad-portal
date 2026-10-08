import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { dayNumberOn } from './progress'
import type { CloseDayError, CloseDayInput, VideoRetroInput } from './schema'

export type CloseDayResult =
  | { ok: true; updated: boolean }
  | { ok: false; error: Extract<CloseDayError, 'invalid_day' | 'future_day' | 'not_found'> }

/**
 * Closes (or re-saves) one day of a challenge for a signed-in admin. Idempotent: the day is
 * upserted, and the unique (challenge, dayNumber) index makes a concurrent double submit end in
 * exactly one row. Writes run with the caller's `user` and `overrideAccess: false`, so the
 * collection access rules apply on top of the checks here.
 */
export async function closeDay(
  payload: Payload,
  user: TypedUser,
  { slug, dayNumber, minutes, notes }: Omit<CloseDayInput, 'notes'> & { notes?: string },
  now: Date = new Date(),
): Promise<CloseDayResult> {
  const { docs } = await payload.find({
    collection: 'challenges',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    select: { startDate: true, timeZone: true, durationDays: true },
    user,
    overrideAccess: false,
  })
  const challenge = docs[0]
  if (!challenge) return { ok: false, error: 'not_found' }

  if (dayNumber < 1 || dayNumber > challenge.durationDays)
    return { ok: false, error: 'invalid_day' }
  // Today and the past are allowed (backfilling); the calendar is the challenge's own time zone.
  if (dayNumber > dayNumberOn(now, challenge.startDate, challenge.timeZone)) {
    return { ok: false, error: 'future_day' }
  }

  const write = (existing: { id: number; closedAt?: string | null }) =>
    payload.update({
      collection: 'challenge-days',
      id: existing.id,
      data: { minutes, notes: notes ?? null, closedAt: existing.closedAt ?? now.toISOString() },
      user,
      overrideAccess: false,
    })
  const findExisting = async () =>
    (
      await payload.find({
        collection: 'challenge-days',
        where: { challenge: { equals: challenge.id }, dayNumber: { equals: dayNumber } },
        limit: 1,
        depth: 0,
        user,
        overrideAccess: false,
      })
    ).docs[0]

  const existing = await findExisting()
  if (existing) {
    await write(existing)
    return { ok: true, updated: true }
  }

  try {
    await payload.create({
      collection: 'challenge-days',
      data: { challenge: challenge.id, dayNumber, minutes, notes, closedAt: now.toISOString() },
      user,
      overrideAccess: false,
    })
    return { ok: true, updated: false }
  } catch (error) {
    // A double submit passed the check above twice; the unique index let one insert win.
    const winner = await findExisting()
    if (!winner) throw error
    await write(winner)
    return { ok: true, updated: true }
  }
}

/** Update the selected embedded video; preserve row ids, titles and the other blocks. */
export async function saveVideoRetro(payload: Payload, user: TypedUser, input: VideoRetroInput) {
  const { slug, blockNumber, ...video } = input
  const { docs } = await payload.find({
    collection: 'challenges',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const challenge = docs[0]
  if (!challenge) return { ok: false, error: 'not_found' } as const
  if (!challenge.videos?.[blockNumber - 1]) return { ok: false, error: 'invalid_request' } as const
  await payload.update({
    collection: 'challenges',
    id: challenge.id,
    user,
    overrideAccess: false,
    data: {
      videos: challenge.videos.map((existing, index) =>
        index === blockNumber - 1
          ? { ...existing, ...video, publishedAt: `${video.publishedAt}T00:00:00.000Z` }
          : existing,
      ),
    },
  })
  return { ok: true } as const
}
