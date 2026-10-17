import type { CollectionConfig } from 'payload'

import { owner } from '@/access'
import { DAYS, MAX_ROWS, MAX_TASK_TEXT } from '@/features/planner/shape'

import { ownPlannerOrOwner } from './Planners'

/** One task cell (week × priority row × weekday). Empty untouched cells are not stored. */
export const PlannerCells: CollectionConfig = {
  slug: 'planner-cells',
  labels: { singular: 'Ячейка планера', plural: 'Ячейки планеров' },
  admin: { useAsTitle: 'text', defaultColumns: ['week', 'row', 'day', 'text', 'done'] },
  access: {
    read: ownPlannerOrOwner('week.planner.student'),
    create: owner,
    update: owner,
    delete: owner,
  },
  fields: [
    {
      name: 'week',
      type: 'relationship',
      relationTo: 'planner-weeks',
      required: true,
      index: true,
    },
    { name: 'row', type: 'number', required: true, min: 0, max: MAX_ROWS - 1 },
    { name: 'day', type: 'number', required: true, min: 0, max: DAYS - 1 },
    { name: 'text', type: 'textarea', maxLength: MAX_TASK_TEXT, defaultValue: '' },
    { name: 'done', type: 'checkbox', defaultValue: false },
    // The student wrote this task herself (story 034); the owner's edit clears it.
    { name: 'own', type: 'checkbox', defaultValue: false },
  ],
  indexes: [{ fields: ['week', 'row', 'day'], unique: true }],
}
