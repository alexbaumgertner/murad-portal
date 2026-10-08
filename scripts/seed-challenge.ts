import type { Payload } from 'payload'
import en from '../messages/en.json'
import ru from '../messages/ru.json'

/** Idempotent public demo, shared by the local seed and end-to-end fixtures. */
export async function seedDemoChallenge(payload: Payload, slug = '90-90-1') {
  const context = { disableRevalidate: true }
  const existing = await payload.find({
    collection: 'challenges',
    where: { slug: { equals: slug } },
    depth: 0,
  })
  if (existing.docs[0]) return existing.docs[0]
  const startDate = new Date(Date.now() - 15 * 86_400_000).toISOString().slice(0, 10)
  const created = await payload.create({
    collection: 'challenges',
    locale: 'en',
    context,
    data: {
      slug,
      title: en.Challenge.demoTitle,
      startDate,
      timeZone: 'Asia/Almaty',
      durationDays: 90,
      dailyMinutes: 90,
      blockDays: 15,
      isPublic: true,
      rules: {
        root: {
          type: 'root',
          format: '',
          indent: 0,
          version: 1,
          direction: 'ltr',
          children: [
            {
              type: 'paragraph',
              format: '',
              indent: 0,
              version: 1,
              direction: 'ltr',
              children: [
                {
                  type: 'text',
                  text: en.Challenge.demoRules,
                  format: 0,
                  detail: 0,
                  mode: 'normal',
                  style: '',
                  version: 1,
                },
              ],
            },
          ],
        },
      },
      videos: Array.from({ length: 6 }, (_, index) => ({
        title: en.Challenge.demoTopic,
        ...(index === 0
          ? {
              youtubeUrl: 'https://www.youtube.com/@muraduzhakhov66',
              publishedAt: new Date(Date.now() - 86_400_000).toISOString(),
            }
          : {}),
      })),
    },
  })
  await payload.update({
    collection: 'challenges',
    id: created.id,
    locale: 'ru',
    context,
    data: { title: ru.Challenge.demoTitle },
  })
  for (const dayNumber of [1, 2, 3]) {
    await payload.create({
      collection: 'challenge-days',
      context,
      data: {
        challenge: created.id,
        dayNumber,
        minutes: 90,
        notes: en.Challenge.demoNotes,
        closedAt: new Date(
          Date.parse(`${startDate}T12:00:00Z`) + (dayNumber - 1) * 86_400_000,
        ).toISOString(),
      },
    })
  }
  return created
}
