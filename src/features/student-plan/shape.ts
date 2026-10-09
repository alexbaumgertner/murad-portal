// Pure rules of a student's personal plan (story 018), shared by the collection, the pages and
// unit tests. No framework imports.

import { PLAN_DAYS } from '@/features/program-plan/shape'

type Rel = number | { id: number } | null | undefined
type Text = { ru?: string | null; en?: string | null } | null | undefined

const idOf = (value: Rel) => (typeof value === 'object' && value ? value.id : (value ?? null))

const sameText = (a: Text, b: Text) =>
  (a?.ru ?? '') === (b?.ru ?? '') && (a?.en ?? '') === (b?.en ?? '')

/**
 * What an owner's update does to a task: a newly picked pool task brings its text (`pool`), a
 * changed text or a cleared pool task makes the task Murad's own (`custom`), anything else keeps
 * the task as it was (`same`). Keys missing from `incoming` are not being changed.
 */
export function editKind(
  original: { sourceTask?: Rel; text?: Text },
  incoming: { sourceTask?: Rel; text?: Text; [key: string]: unknown },
): 'pool' | 'custom' | 'same' {
  if ('sourceTask' in incoming && idOf(incoming.sourceTask) !== idOf(original.sourceTask)) {
    return idOf(incoming.sourceTask) == null ? 'custom' : 'pool'
  }
  if ('text' in incoming && !sameText(incoming.text, original.text)) return 'custom'
  return 'same'
}

/** Program week (1-based) of a program day (1-based). */
export const weekOfDay = (programDay: number) => Math.ceil(programDay / PLAN_DAYS)

/** Murad writes in Russian; the English text is optional and shown only when it is there. */
export function taskText(text: { ru: string; en?: string | null }, locale: 'ru' | 'en'): string {
  const en = text.en?.trim()
  return locale === 'en' && en ? en : text.ru
}

export type PlanItemView = { id: number; day: number; order: number; text: string }
export type PlanDayView = { day: number; programDay: number; tasks: PlanItemView[] }

/** One week as 7 days (empty ones included), each day's tasks in their order. */
export function groupWeek(items: PlanItemView[], week: number): PlanDayView[] {
  return Array.from({ length: PLAN_DAYS }, (_, i) => ({
    day: i + 1,
    programDay: (week - 1) * PLAN_DAYS + i + 1,
    tasks: items.filter((item) => item.day === i + 1).sort((a, b) => a.order - b.order),
  }))
}
