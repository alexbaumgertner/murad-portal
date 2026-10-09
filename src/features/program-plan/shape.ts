// Pure rules of the default plan, shared by the collection hooks, the grid and unit tests.
// No framework imports.

import { LEVELS, isLevel } from '@/features/programs/shape'

export const PLAN_DAYS = 7
export const MAX_TASKS_PER_DAY = 3
export const MAX_TITLE = 80
export const MAX_TASK_TEXT = 1000

export const messages = {
  levelOutside: (level: string, from: string, to: string) =>
    `Уровень задания (${level}) вне программы ${from} → ${to}`,
  dayFull: 'В дне не больше 3 заданий',
  weekRange: (max: number) => `Неделя должна быть от 1 до ${max}`,
  dayRange: 'День должен быть от 1 до 7',
  orderRange: 'Порядок должен быть от 1 до 3',
  placeTaken: 'Это место в плане уже занято',
  taskInUse: 'Задание используется в программах: ',
  weeksAfter: (week: number) => `Есть задания после недели ${week}: удали их сначала`,
  poolHint: 'Изменения попадут только в новые планы',
} as const

export const copySummary = (copied: number, skipped: number) =>
  `Скопировано: ${copied}, пропущено (занято): ${skipped}`

/** True when `level` lies in [from, to] of CEFR order; unknown values are left to the select field. */
export const levelWithinProgram = (level: unknown, from: unknown, to: unknown): boolean => {
  if (!isLevel(level) || !isLevel(from) || !isLevel(to)) return true
  const at = LEVELS.indexOf(level)
  return at >= LEVELS.indexOf(from) && at <= LEVELS.indexOf(to)
}

const isIntBetween = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

export const isWeek = (value: unknown, durationWeeks: number) =>
  isIntBetween(value, 1, durationWeeks)
export const isDay = (value: unknown) => isIntBetween(value, 1, PLAN_DAYS)
export const isOrder = (value: unknown) => isIntBetween(value, 1, MAX_TASKS_PER_DAY)

export type PlanPosition = { week: number; day: number; order: number }
export type PlanCopyItem = PlanPosition & { task: number }

export const positionKey = ({ week, day, order }: PlanPosition) => `${week}:${day}:${order}`

/**
 * Items to create when `source` (one week) is copied into `targetWeeks`. A place that is already
 * taken is skipped, never overwritten, and counted.
 */
export function planWeekCopy(
  source: PlanCopyItem[],
  targetWeeks: number[],
  occupied: ReadonlySet<string>,
): { create: PlanCopyItem[]; skipped: number } {
  const create: PlanCopyItem[] = []
  let skipped = 0
  for (const week of targetWeeks) {
    for (const item of source) {
      const target = { ...item, week }
      if (occupied.has(positionKey(target))) skipped += 1
      else create.push(target)
    }
  }
  return { create, skipped }
}
