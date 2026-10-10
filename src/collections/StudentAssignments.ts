import {
  ValidationError,
  type Access,
  type CollectionBeforeValidateHook,
  type CollectionConfig,
} from 'payload'

import { isOwner, owner } from '@/access'
import {
  MAX_TASKS_PER_DAY,
  MAX_TASK_TEXT,
  isDay,
  isOrder,
  isWeek,
  levelWithinProgram,
  messages,
} from '@/features/program-plan/shape'
import { PLAN_COPY } from '@/features/student-plan/copy-plan'
import { editKind } from '@/features/student-plan/shape'

type Rel = number | { id: number } | null | undefined
type Text = { ru?: string | null; en?: string | null }
type AssignmentData = {
  enrollment?: Rel
  sourceTask?: Rel
  text?: Text
  week?: number
  day?: number
  order?: number
  editedByOwner?: boolean
}

const idOf = (value: Rel) => (typeof value === 'object' && value ? value.id : (value ?? undefined))

const fail = (path: string, message: string): never => {
  throw new ValidationError({ collection: 'student-assignments', errors: [{ path, message }] })
}

// Owner: everything. Student: the tasks of her own enrollments, every week (Q7). Anonymous: 403.
const ownPlanOrOwner: Access = ({ req }) => {
  if (isOwner(req.user)) return true
  if (req.user) return { 'enrollment.student': { equals: req.user.id } }
  return false
}

/**
 * Every write but the copy on assignment is Murad editing one student's plan: same ranges and
 * levels as the program plan (010), at most 3 tasks a day, and the edit is marked. A newly picked
 * pool task brings its text; a changed text makes the task his own (no `sourceTask`).
 */
const validateRules: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (req.context[PLAN_COPY]) return data
  const incoming = (data ?? {}) as AssignmentData
  const original = (originalDoc ?? {}) as AssignmentData & { id?: number }
  const next: AssignmentData = { ...incoming, editedByOwner: true }

  const kind = operation === 'create' ? (idOf(incoming.sourceTask) ? 'pool' : 'custom') : null
  const change = kind ?? editKind(original, incoming)
  if (change === 'custom') next.sourceTask = null

  const merged: AssignmentData = { ...original, ...next }
  const enrollmentId = idOf(merged.enrollment)
  if (enrollmentId == null) return next // `required` reports the missing relation

  const enrollment = await req.payload.findByID({
    collection: 'enrollments',
    id: enrollmentId,
    depth: 1,
    overrideAccess: true, // integrity check, not a visitor read
    req,
    disableErrors: true,
  })
  const program = enrollment && typeof enrollment.program === 'object' ? enrollment.program : null
  if (!program) return fail('enrollment', 'Назначение не найдено')

  if (!isWeek(merged.week, program.durationWeeks)) {
    fail('week', messages.weekRange(program.durationWeeks))
  }
  if (!isDay(merged.day)) fail('day', messages.dayRange)

  const taskId = idOf(merged.sourceTask)
  if (taskId != null) {
    const task = await req.payload.findByID({
      collection: 'task-pool',
      id: taskId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (!levelWithinProgram(task.level, program.levelFrom, program.levelTo)) {
      fail('sourceTask', messages.levelOutside(task.level, program.levelFrom, program.levelTo))
    }
    if (change === 'pool') next.text = { ru: task.text.ru, en: task.text.en ?? null }
  }
  if (!(next.text ?? merged.text)?.ru?.trim())
    fail('text.ru', 'Напиши задание или выбери его из пула')

  const others = {
    enrollment: { equals: enrollmentId },
    week: { equals: merged.week },
    day: { equals: merged.day },
    ...(original.id != null ? { id: { not_equals: original.id } } : {}),
  }
  const { totalDocs: sameDay } = await req.payload.count({
    collection: 'student-assignments',
    where: others,
    overrideAccess: true,
    req,
  })
  if (sameDay >= MAX_TASKS_PER_DAY) fail('day', messages.dayFull)

  if (!isOrder(merged.order)) fail('order', messages.orderRange)
  const { totalDocs: samePlace } = await req.payload.count({
    collection: 'student-assignments',
    where: { ...others, order: { equals: merged.order } },
    overrideAccess: true,
    req,
  })
  if (samePlace > 0) fail('order', messages.placeTaken)
  return next
}

export const StudentAssignments: CollectionConfig = {
  slug: 'student-assignments',
  labels: { singular: 'Задание ученика', plural: 'Планы учеников' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['enrollment', 'week', 'day', 'order', 'sourceTask', 'editedByOwner'],
    description:
      'Личный план ученика: копия плана программы на момент назначения. Правки меняют только этого ученика. Сетка — на странице ученика (Users → ученик → «План ученика»).',
  },
  access: { read: ownPlanOrOwner, create: owner, update: owner, delete: owner },
  hooks: { beforeValidate: [validateRules] },
  indexes: [{ fields: ['enrollment', 'week', 'day', 'order'], unique: true }],
  fields: [
    {
      name: 'enrollment',
      type: 'relationship',
      relationTo: 'enrollments',
      required: true,
      index: true,
      // A task belongs to one plan for good; move it by deleting and adding.
      access: { update: () => false },
    },
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
    {
      name: 'sourceTask',
      type: 'relationship',
      relationTo: 'task-pool',
      index: true,
      label: 'Из пула',
      admin: {
        description:
          'Выбери задание из пула — его текст скопируется. Пусто — своё задание (текст ниже).',
      },
    },
    {
      name: 'text',
      type: 'group',
      label: 'Текст',
      admin: { description: 'Копия, не ссылка: правки пула сюда не попадают.' },
      fields: [
        {
          // Required in effect: the hook fills it from the pool task or refuses an empty one. Not
          // `required` here, or the form would refuse a pool task before its text is copied.
          name: 'ru',
          type: 'textarea',
          maxLength: MAX_TASK_TEXT,
        },
        { name: 'en', type: 'textarea', maxLength: MAX_TASK_TEXT },
      ],
    },
    {
      name: 'editedByOwner',
      type: 'checkbox',
      defaultValue: false,
      label: 'Изменено владельцем',
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
}
