import { z } from 'zod'

/**
 * «Пауза» and «Продолжить» (story 017) take nothing from the browser: the enrollment is the
 * signed-in student's own and the date is the server's, in her time zone.
 */
export const emptySchema = z.strictObject({})

export type PauseError =
  'unauthorized' | 'invalid_input' | 'no_program' | 'program_over' | 'not_paused' | 'server'

export type PauseActionState = { status: 'success' } | { status: 'error'; error: PauseError }
