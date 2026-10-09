import { z } from 'zod'

import { MAX_SLOT_INDEX, type TimerState } from './shape'

/** «Старт»: the only thing the browser names is which of today's slots. Dates and minutes are the server's. */
export const startSchema = z.strictObject({
  slotIndex: z.number().int().min(0).max(MAX_SLOT_INDEX),
})

/** «Стоп» and the check at the minimum take nothing: the running timer is the signed-in student's own. */
export const emptySchema = z.strictObject({})

/**
 * «Отметить вручную» (story 015): which slot of which program day and how many minutes. The
 * enrollment is never in the input: it is the signed-in student's own. The 600-minute limit is the
 * service's, so it can answer with its own message.
 */
export const markSchema = z.strictObject({
  programDay: z.number().int().min(1).max(10_000),
  slotIndex: z.number().int().min(0).max(MAX_SLOT_INDEX),
  minutes: z.number().int().min(0).max(1_000_000),
})

export type TimerError =
  | 'unauthorized'
  | 'invalid_input'
  | 'no_program'
  | 'invalid_slot'
  | 'program_over'
  | 'forbidden'
  | 'paused'
  | 'too_many_minutes'
  | 'server'

export type TimerActionState =
  { status: 'success'; state: TimerState } | { status: 'error'; error: TimerError }
