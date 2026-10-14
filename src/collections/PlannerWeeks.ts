import type { CollectionBeforeDeleteHook, CollectionConfig } from 'payload'

import { owner } from '@/access'
import { MAX_ROWS } from '@/features/planner/shape'

import { ownPlannerOrOwner } from './Planners'

const deleteCells: CollectionBeforeDeleteHook = async ({ id, req }) => {
  for (const collection of ['planner-cells', 'planner-notes'] as const)
    await req.payload.delete({
      collection,
      where: { week: { equals: id } },
      overrideAccess: true,
      req,
    })
}

/** A week of a planner: its 0-based index (gaps allowed) and how many priority rows it has. */
export const PlannerWeeks: CollectionConfig = {
  slug: 'planner-weeks',
  labels: { singular: 'Неделя планера', plural: 'Недели планеров' },
  admin: { useAsTitle: 'index', defaultColumns: ['planner', 'index', 'rowCount'] },
  access: {
    read: ownPlannerOrOwner('planner.student'),
    create: owner,
    update: owner,
    delete: owner,
  },
  hooks: { beforeDelete: [deleteCells] },
  fields: [
    { name: 'planner', type: 'relationship', relationTo: 'planners', required: true, index: true },
    { name: 'index', type: 'number', required: true, min: 0, max: 520 },
    { name: 'rowCount', type: 'number', required: true, defaultValue: 1, min: 1, max: MAX_ROWS },
  ],
  indexes: [{ fields: ['planner', 'index'], unique: true }],
}
