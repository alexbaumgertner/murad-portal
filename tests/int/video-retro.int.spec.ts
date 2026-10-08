import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { saveVideoRetroAction } from '@/features/challenge/actions'
import { issueToken, SESSION_COOKIE } from '@/features/auth/session'
import { getPublicChallenge } from '@/features/challenge/queries'
import { summarize } from '@/features/challenge/progress'

const request = vi.hoisted(() => ({ headers: new Headers() }))
vi.mock('next/headers', () => ({ headers: async () => request.headers }))
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }))
vi.mock('next/cache', () => cache)
let payload: Payload
let id: number
let userId: number
const slug = 'int-video-retro'
const context = { disableRevalidate: true }
const submit = (fields: Record<string, string | undefined> = {}) => {
  const data = new FormData()
  Object.entries({
    slug,
    blockNumber: '1',
    youtubeUrl: 'https://youtu.be/abcdefghijk',
    publishedAt: '2026-10-08',
    retroWorked: 'Intro',
    retroDropped: 'Long pause',
    retroChange: 'Shorten',
    ...fields,
  }).forEach(([key, value]) => data.set(key, value ?? ''))
  return saveVideoRetroAction({ status: 'idle' }, data)
}
const read = () => payload.findByID({ collection: 'challenges', id, depth: 0 })
beforeAll(async () => {
  payload = await getPayload({ config })
  userId = (
    await payload.create({
      collection: 'users',
      data: { email: `retro-${Date.now()}@example.com` },
    })
  ).id
  id = (
    await payload.create({
      collection: 'challenges',
      context,
      data: {
        slug,
        title: 'Retro',
        startDate: '2026-10-01',
        durationDays: 90,
        blockDays: 15,
        dailyMinutes: 90,
        timeZone: 'Asia/Almaty',
        isPublic: true,
        videos: Array.from({ length: 6 }, (_, i) => ({ title: `Video ${i + 1}` })),
      },
    })
  ).id
})
beforeEach(async () => {
  vi.clearAllMocks()
  const { token } = issueToken(userId, payload.secret)
  request.headers = new Headers({ cookie: `${SESSION_COOKIE}=${token}` })
  await payload.update({
    collection: 'challenges',
    id,
    context,
    data: {
      isPublic: true,
      videos: Array.from({ length: 6 }, (_, i) => ({ title: `Video ${i + 1}` })),
    },
  })
})
afterAll(async () => {
  await payload.delete({ collection: 'challenges', id, context })
  await payload.delete({ collection: 'users', id: userId })
  await payload.destroy()
})
it('saves, updates, preserves other blocks and revalidates (criteria 1, 2)', async () => {
  await submit({ blockNumber: '2' })
  await submit({ retroWorked: 'New intro' })
  expect(await submit({ retroWorked: '' })).toEqual({ status: 'success' })
  const result = await getPublicChallenge(payload, slug, 'en')
  expect(result?.challenge.videos?.[0]).toMatchObject({
    title: 'Video 1',
    retroWorked: '',
    retroDropped: 'Long pause',
    retroChange: 'Shorten',
  })
  expect(result?.challenge.videos?.[1]?.youtubeUrl).toBe('https://youtu.be/abcdefghijk')
  expect(cache.revalidatePath).toHaveBeenCalledWith(`/en/challenge/${slug}`)
  expect(cache.revalidatePath).toHaveBeenCalledWith(`/ru/challenge/${slug}`)
})
it.each(['2000-01-01', '2099-01-01'])(
  'accepts and counts %s outside the challenge (criterion 5)',
  async (publishedAt) => {
    expect(await submit({ publishedAt })).toEqual({ status: 'success' })
    const challenge = await read()
    expect(summarize(challenge, [], new Date()).videosPublished).toBe(1)
  },
)
it.each([
  { youtubeUrl: 'javascript:alert(1)' },
  { youtubeUrl: 'https://example.com' },
  { retroWorked: 'x'.repeat(401) },
  { retroDropped: 'x'.repeat(401) },
  { retroChange: 'x'.repeat(401) },
  { blockNumber: '7' },
])('refuses invalid input without saving (criteria 3, 4)', async (fields) => {
  expect(await submit(fields)).toMatchObject({ status: 'error' })
  expect((await read()).videos?.[0]?.publishedAt).toBeFalsy()
})
it.each(['', `${SESSION_COOKIE}=forged`])(
  'refuses unauthenticated calls before validation (criterion 6)',
  async (cookie) => {
    request.headers = new Headers({ cookie })
    expect(await submit({ youtubeUrl: 'javascript:alert(1)' })).toEqual({
      status: 'error',
      error: 'unauthorized',
    })
    expect((await read()).videos?.[0]?.publishedAt).toBeFalsy()
  },
)
it('keeps a private challenge hidden after saving (criterion 2)', async () => {
  await payload.update({ collection: 'challenges', id, context, data: { isPublic: false } })
  expect(await submit()).toEqual({ status: 'success' })
  expect(await getPublicChallenge(payload, slug, 'en')).toBeNull()
})
