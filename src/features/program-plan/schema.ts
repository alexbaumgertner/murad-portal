import { z } from 'zod'

const weekNumber = z.coerce.number().int().min(1).max(104)

export const copyWeekSchema = z.object({
  programId: z.coerce.number().int().positive(),
  fromWeek: weekNumber,
  toFirst: weekNumber,
  toLast: weekNumber,
})

export type CopyWeekInput = z.infer<typeof copyWeekSchema>

export type CopyWeekError = 'forbidden' | 'invalid_input' | 'invalid_range' | 'not_found' | 'server'

export type CopyWeekState =
  | { status: 'idle' }
  | { status: 'success'; copied: number; skipped: number }
  | { status: 'error'; error: CopyWeekError }

export const initialCopyWeekState: CopyWeekState = { status: 'idle' }
