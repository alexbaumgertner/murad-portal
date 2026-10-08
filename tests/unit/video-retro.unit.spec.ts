import { expect, it } from 'vitest'
import { videoRetroSchema } from '@/features/challenge/schema'

const input = {
  slug: 'demo',
  blockNumber: 1,
  youtubeUrl: 'https://youtu.be/abcdefghijk',
  publishedAt: '2026-10-08',
  retroWorked: '',
  retroDropped: '',
  retroChange: '',
}
it.each([
  'https://www.youtube.com/watch?v=abcdefghijk',
  'https://youtu.be/abcdefghijk?t=30',
  'https://youtube.com/shorts/abcdefghijk',
])('accepts %s (criterion 3)', (youtubeUrl) => {
  expect(videoRetroSchema.safeParse({ ...input, youtubeUrl }).success).toBe(true)
})
it.each([
  'javascript:alert(1)',
  'https://example.com/watch?v=abcdefghijk',
  'https://youtube.com.evil.com/watch?v=abcdefghijk',
  'https://youtube.com/embed/abcdefghijk',
  'https://youtube.com/playlist?list=abc',
  'https://youtu.be/',
  'https://youtube.com/watch',
  'https://youtu.be/abcdefghijk/extra',
  'ftp://youtu.be/abcdefghijk',
  'https://user@youtube.com/watch?v=abcdefghijk',
])('rejects %s (criterion 3)', (youtubeUrl) => {
  expect(videoRetroSchema.safeParse({ ...input, youtubeUrl }).success).toBe(false)
})
it.each(['retroWorked', 'retroDropped', 'retroChange'])(
  'bounds %s at 400 characters (criterion 4)',
  (key) => {
    expect(videoRetroSchema.safeParse({ ...input, [key]: 'x'.repeat(400) }).success).toBe(true)
    expect(videoRetroSchema.safeParse({ ...input, [key]: 'x'.repeat(401) }).success).toBe(false)
  },
)
it.each(['2026-02-30', '', 'tomorrow'])('rejects invalid date %s', (publishedAt) => {
  expect(videoRetroSchema.safeParse({ ...input, publishedAt }).success).toBe(false)
})
