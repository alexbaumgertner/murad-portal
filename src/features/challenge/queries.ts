import 'server-only'
import type { Payload } from 'payload'
import { summarize } from '@/features/challenge/progress'
import type { locales } from '@/i18n/locales'

/** Anonymous reads only; do not forward the current admin session to this public page. */
export async function getPublicChallenge(
  payload: Payload,
  slug: string,
  locale: (typeof locales)[number],
) {
  const { docs } = await payload.find({
    collection: 'challenges',
    where: { slug: { equals: slug }, isPublic: { equals: true } },
    locale,
    fallbackLocale: 'en',
    limit: 1,
    depth: 0,
    overrideAccess: false,
  })
  const challenge = docs[0]
  if (!challenge) return null
  const { docs: days } = await payload.find({
    collection: 'challenge-days',
    where: { challenge: { equals: challenge.id } },
    limit: challenge.durationDays,
    sort: 'dayNumber',
    depth: 0,
    overrideAccess: false,
  })
  return { challenge, days }
}

/** Public challenges, newest start first, each with its progress summary. Anonymous reads only. */
export async function listPublicChallenges(
  payload: Payload,
  locale: (typeof locales)[number],
  now = new Date(),
) {
  const { docs } = await payload.find({
    collection: 'challenges',
    where: { isPublic: { equals: true } },
    sort: '-startDate',
    locale,
    fallbackLocale: 'en',
    limit: 100,
    depth: 0,
    overrideAccess: false,
  })
  if (docs.length === 0) return []
  const { docs: days } = await payload.find({
    collection: 'challenge-days',
    where: { challenge: { in: docs.map((challenge) => challenge.id) } },
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: false,
  })
  return docs.map((challenge) => ({
    challenge,
    slug: challenge.slug,
    summary: summarize(
      challenge,
      days.filter((day) => day.challenge === challenge.id),
      now,
    ),
  }))
}
