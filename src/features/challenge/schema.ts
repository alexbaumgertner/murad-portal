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
