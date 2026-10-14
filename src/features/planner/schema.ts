import { z } from 'zod'

import { DAYS, MAX_DEADLINE_TITLE, MAX_ROWS, MAX_TASK_TEXT, isIsoDate } from './shape'

const id = z.number().int().positive()
const row = z
  .number()
  .int()
  .min(0)
  .max(MAX_ROWS - 1)
const day = z
  .number()
  .int()
  .min(0)
  .max(DAYS - 1)

export const createPlannerSchema = z.strictObject({
  studentId: id,
  baseDate: z.string().refine(isIsoDate),
})
export const plannerIdSchema = z.strictObject({ plannerId: id })
export const weekIdSchema = z.strictObject({ weekId: id })
export const setTextSchema = z.strictObject({
  weekId: id,
  row,
  day,
  text: z.string().max(MAX_TASK_TEXT),
})
export const setDoneSchema = z.strictObject({ weekId: id, row, day, done: z.boolean() })

export const progressSettingsSchema = z.strictObject({
  plannerId: id,
  showWeekProgress: z.boolean(),
  showFourWeekProgress: z.boolean(),
  showDeadlineProgress: z.boolean(),
  deadlineTitle: z.string().trim().max(MAX_DEADLINE_TITLE),
  /** Empty clears the deadline. */
  deadlineDate: z.union([z.literal(''), z.string().refine(isIsoDate)]),
})
export type ProgressSettingsInput = z.infer<typeof progressSettingsSchema>

export type PlannerError =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_input'
  | 'not_found'
  | 'exists'
  | 'too_long'
  | 'min_rows'
  | 'max_rows'
  | 'empty_task'
  | 'server'

export type PlannerActionState = { status: 'success' } | { status: 'error'; error: PlannerError }
