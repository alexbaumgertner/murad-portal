import { z } from 'zod'

/** Same bounds as the `challenge-days` collection; the real upper day limit is the challenge's own. */
export const MAX_DAY_NUMBER = 365
export const MAX_MINUTES = 600
export const MAX_NOTES_LENGTH = 500

export const closeDaySchema = z.object({
  slug: z.string().trim().min(1).max(100),
  dayNumber: z.coerce.number().int().min(1).max(MAX_DAY_NUMBER),
  minutes: z.coerce.number().int().min(1).max(MAX_MINUTES),
  // Empty notes mean "no notes": normalised here so the service never sees ''.
  notes: z
    .string()
    .trim()
    .max(MAX_NOTES_LENGTH)
    .optional()
    .transform((value) => value || undefined),
})

export type CloseDayInput = z.infer<typeof closeDaySchema>

/** Codes, not copy: the cell translates them (messages/<locale>.json → Challenge.closeDay.errors). */
export type CloseDayError =
  | 'unauthorized'
  | 'invalid_request'
  | 'invalid_day'
  | 'invalid_minutes'
  | 'invalid_notes'
  | 'future_day'
  | 'not_found'
  | 'server'

export type CloseDayState =
  | { status: 'idle' }
  | { status: 'success'; dayNumber: number; updated: boolean }
  | { status: 'error'; error: CloseDayError }

export const initialCloseDayState: CloseDayState = { status: 'idle' }

/** Only actual YouTube video links; never trust a URL's apparent prefix or scheme. */
export function isYouTubeVideoUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value) || /[\s\\]/.test(value)) return false
  try {
    const url = new URL(value)
    if (url.username || url.password || url.port) return false
    if (url.hostname === 'youtu.be') return /^\/[\w-]{11}\/?$/.test(url.pathname)
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) return false
    return (
      /^\/shorts\/[\w-]{11}\/?$/.test(url.pathname) ||
      (url.pathname === '/watch' &&
        url.searchParams.getAll('v').length === 1 &&
        /^[\w-]{11}$/.test(url.searchParams.get('v') ?? ''))
    )
  } catch {
    return false
  }
}

export const retroFields = ['retroWorked', 'retroDropped', 'retroChange'] as const
const retroAnswer = z.string().trim().max(400)
export const videoRetroSchema = z.object({
  slug: z.string().trim().min(1).max(100),
  blockNumber: z.coerce.number().int().min(1).max(365),
  youtubeUrl: z.string().trim().max(2048).refine(isYouTubeVideoUrl),
  publishedAt: z.iso.date(),
  retroWorked: retroAnswer,
  retroDropped: retroAnswer,
  retroChange: retroAnswer,
})
export type VideoRetroInput = z.infer<typeof videoRetroSchema>
export type VideoRetroState =
  | { status: 'idle' | 'success' }
  | {
      status: 'error'
      error:
        | 'unauthorized'
        | 'invalid_request'
        | 'invalid_url'
        | 'invalid_date'
        | 'invalid_retro'
        | 'not_found'
        | 'server'
    }
