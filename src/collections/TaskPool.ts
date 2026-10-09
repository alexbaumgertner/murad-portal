import { APIError, type CollectionBeforeDeleteHook, type CollectionConfig } from 'payload'

import { owner } from '@/access'
import { LEVELS } from '@/features/programs/shape'
import { MAX_TASK_TEXT, MAX_TITLE, messages } from '@/features/program-plan/shape'

// program-plan-items.task would be silently nulled by the database: refuse the delete and name
// the programs (drafts included) whose plan still uses the task.
const blockDeleteWhenUsed: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const { docs } = await req.payload.find({
    collection: 'program-plan-items',
    where: { task: { equals: id } },
    depth: 1,
    limit: 200,
    pagination: false,
    select: { program: true },
    populate: { programs: { title: true } },
    locale: 'ru',
    fallbackLocale: 'en',
    overrideAccess: true, // integrity check, not a visitor read
    req,
  })
  const titles = new Set<string>()
  for (const item of docs) {
    if (typeof item.program === 'object' && item.program) titles.add(item.program.title)
  }
  if (docs.length > 0) {
    throw new APIError(messages.taskInUse + [...titles].join(', '), 400, undefined, true)
  }
}

export const TaskPool: CollectionConfig = {
  slug: 'task-pool',
  labels: { singular: 'Задание', plural: 'Пул заданий' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'level', 'slotType', 'updatedAt'],
    listSearchableFields: ['title'],
    description:
      'Задания, из которых собираются планы программ. Студенты видят копии, не эти записи.',
  },
  // Students see copies of tasks in their own plan (story 018), never the pool itself.
  access: { read: owner, create: owner, update: owner, delete: owner },
  hooks: { beforeDelete: [blockDeleteWhenUsed] },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'level',
          type: 'select',
          required: true,
          index: true,
          options: [...LEVELS],
        },
        {
          name: 'slotType',
          type: 'relationship',
          relationTo: 'slot-types',
          index: true,
          admin: { description: 'К какому занятию относится задание (необязательно).' },
        },
      ],
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: MAX_TITLE,
      admin: { description: 'Для списков Мурада, студентам не показывается.' },
    },
    {
      name: 'text',
      type: 'group',
      admin: { description: messages.poolHint },
      fields: [
        { name: 'ru', type: 'textarea', required: true, maxLength: MAX_TASK_TEXT },
        { name: 'en', type: 'textarea', maxLength: MAX_TASK_TEXT },
      ],
    },
  ],
}
