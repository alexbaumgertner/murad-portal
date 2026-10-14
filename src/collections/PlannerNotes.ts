import type { CollectionConfig } from 'payload'

import { owner } from '@/access'
import { DAYS, MAX_NOTE, NOTE_KINDS } from '@/features/planner/shape'

import { ownPlannerOrOwner } from './Planners'

/** One mini-diary entry (Exercises / Questions × weekday) of a week. Empty entries are not stored. */
export const PlannerNotes: CollectionConfig = {
  slug: 'planner-notes',
  labels: { singular: 'Запись дневника', plural: 'Записи дневника' },
  admin: { useAsTitle: 'text', defaultColumns: ['week', 'kind', 'day', 'text'] },
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
    { name: 'kind', type: 'select', required: true, options: [...NOTE_KINDS] },
    { name: 'day', type: 'number', required: true, min: 0, max: DAYS - 1 },
    { name: 'text', type: 'textarea', required: true, maxLength: MAX_NOTE },
  ],
  indexes: [{ fields: ['week', 'kind', 'day'], unique: true }],
}
