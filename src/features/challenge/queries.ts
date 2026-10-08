import 'server-only'
import type { Payload } from 'payload'
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
