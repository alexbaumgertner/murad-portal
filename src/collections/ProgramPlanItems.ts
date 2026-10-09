import { ValidationError, type CollectionBeforeValidateHook, type CollectionConfig } from 'payload'

import { owner } from '@/access'
import {
  MAX_TASKS_PER_DAY,
  isDay,
  isOrder,
  isWeek,
  levelWithinProgram,
  messages,
} from '@/features/program-plan/shape'

type ItemData = {
  program?: number | { id: number }
  task?: number | { id: number }
  week?: number
  day?: number
  order?: number
}

const idOf = (value: number | { id: number } | undefined | null) =>
  typeof value === 'object' && value ? value.id : (value ?? undefined)

const fail = (path: string, message: string): never => {
  throw new ValidationError({
    collection: 'program-plan-items',
    errors: [{ path, message }],
  })
}

// Cross-field and cross-document rules. Run on the stored values merged with the incoming ones,
// so a partial update (only the day) cannot slip past them.
const validateRules: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const merged: ItemData = { ...(originalDoc as ItemData | undefined), ...(data as ItemData) }
  const programId = idOf(merged.program)
  const taskId = idOf(merged.task)
  if (programId == null || taskId == null) return data // `required` reports the missing relation

  const program = await req.payload.findByID({
    collection: 'programs',
    id: programId,
    depth: 0,
    locale: 'all',
    overrideAccess: true, // integrity check, not a visitor read
    req,
  })
  if (!isWeek(merged.week, program.durationWeeks)) {
    fail('week', messages.weekRange(program.durationWeeks))
  }
  if (!isDay(merged.day)) fail('day', messages.dayRange)

  const task = await req.payload.findByID({
    collection: 'task-pool',
    id: taskId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (!levelWithinProgram(task.level, program.levelFrom, program.levelTo)) {
    fail('task', messages.levelOutside(task.level, program.levelFrom, program.levelTo))
  }

  const id = (originalDoc as { id?: number } | undefined)?.id
  const others = {
    program: { equals: programId },
    week: { equals: merged.week },
    day: { equals: merged.day },
    ...(id != null ? { id: { not_equals: id } } : {}),
  }
  const { totalDocs: sameDay } = await req.payload.count({
    collection: 'program-plan-items',
    where: others,
    overrideAccess: true,
    req,
  })
  if (sameDay >= MAX_TASKS_PER_DAY) fail('day', messages.dayFull)

  if (!isOrder(merged.order)) fail('order', messages.orderRange)
  const { totalDocs: samePlace } = await req.payload.count({
    collection: 'program-plan-items',
    where: { ...others, order: { equals: merged.order } },
    overrideAccess: true,
    req,
  })
  if (samePlace > 0) fail('order', messages.placeTaken)
  return data
}

export const ProgramPlanItems: CollectionConfig = {
  slug: 'program-plan-items',
  labels: { singular: 'Задание плана', plural: 'План по умолчанию' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['program', 'week', 'day', 'order', 'task'],
    description:
      'Задания по неделям и дням. При назначении программы студенту план копируется ему (018).',
    components: {
      // The week × day grid and "copy a week", above the plain list.
      beforeListTable: ['/components/admin/PlanGrid/PlanGrid#PlanGrid'],
    },
  },
  access: { read: owner, create: owner, update: owner, delete: owner },
  hooks: { beforeValidate: [validateRules] },
  indexes: [{ fields: ['program', 'week', 'day', 'order'], unique: true }],
  fields: [
    { name: 'program', type: 'relationship', relationTo: 'programs', required: true, index: true },
    {
      type: 'row',
      fields: [
        { name: 'week', type: 'number', required: true, min: 1, max: 104 },
        { name: 'day', type: 'number', required: true, min: 1, max: 7 },
        {
          name: 'order',
          type: 'number',
          required: true,
          defaultValue: 1,
          min: 1,
          max: MAX_TASKS_PER_DAY,
        },
      ],
    },
    { name: 'task', type: 'relationship', relationTo: 'task-pool', required: true, index: true },
  ],
}
