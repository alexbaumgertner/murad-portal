import { z } from 'zod'

import { DEFAULT_TIMEZONE, isTimeZone } from './shape'

/**
 * «Начать» (story 012). The only input is the browser's time zone: the enrollment is always the
 * signed-in student's own, and the date is decided on the server. An empty zone means the browser
 * could not tell, so Almaty is used (AC 5).
 */
export const startSchema = z.object({
  timezone: z
    .string()
    .trim()
    .max(64)
    .transform((value) => value || DEFAULT_TIMEZONE)
    .refine(isTimeZone),
})

export type StartError = 'unauthorized' | 'invalid_timezone' | 'not_found' | 'server'

export type StartState =
  { status: 'idle' } | { status: 'success' } | { status: 'error'; error: StartError }

export const initialStartState: StartState = { status: 'idle' }
