import { z } from 'zod'

import { MAX_SLOT_INDEX, type TimerState } from './shape'

/** «Старт»: the only thing the browser names is which of today's slots. Dates and minutes are the server's. */
export const startSchema = z.strictObject({
  slotIndex: z.number().int().min(0).max(MAX_SLOT_INDEX),
})

/** «Стоп» and the check at the minimum take nothing: the running timer is the signed-in student's own. */
export const emptySchema = z.strictObject({})

export type TimerError =
  | 'unauthorized'
  | 'invalid_input'
  | 'no_program'
  | 'invalid_slot'
  | 'program_over'
  | 'paused'
  | 'server'

export type TimerActionState =
  { status: 'success'; state: TimerState } | { status: 'error'; error: TimerError }
