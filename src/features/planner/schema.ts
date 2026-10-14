import { z } from 'zod'

import {
  DAYS,
  MAX_DEADLINE_TITLE,
  MAX_HEADER_TEXT,
  MAX_LABEL,
  MAX_NOTE,
  MAX_ROWS,
  MAX_SUBTITLE,
  MAX_TASK_TEXT,
  NOTE_KINDS,
  isIsoDate,
} from './shape'

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

const label = z.string().trim().max(MAX_LABEL)
const sevenLabels = z.array(label).length(DAYS)
/** Overrides of the printed words; an empty string means "use the default". */
export const labelsSchema = z.strictObject({
  schedule: label,
  goal: label,
  exercises: label,
  questions: label,
  days: sevenLabels,
  diaryDays: sevenLabels,
})
export type Labels = Partial<z.infer<typeof labelsSchema>>

export const saveHeaderSchema = z.strictObject({
  plannerId: id,
  studentName: z.string().trim().max(MAX_HEADER_TEXT).optional(),
  goal: z.string().trim().max(MAX_HEADER_TEXT).optional(),
  subtitle: z.string().trim().max(MAX_SUBTITLE).optional(),
  labels: labelsSchema.partial().optional(),
})
export type SaveHeaderInput = z.infer<typeof saveHeaderSchema>

export const saveNoteSchema = z.strictObject({
  weekId: id,
  kind: z.enum(NOTE_KINDS),
  day,
  text: z.string().max(MAX_NOTE),
})

export type NoteInput = z.infer<typeof saveNoteSchema>

export const saveAppearanceSchema = z.strictObject({ plannerId: id, appearance: z.unknown() })

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
