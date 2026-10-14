import type { Access, CollectionBeforeDeleteHook, CollectionConfig } from 'payload'

import { isOwner, owner } from '@/access'
import { isIsoDate, mondayOf } from '@/features/planner/shape'

// Owner: everything. Student: her own planner. Anonymous: 403. Never public (story 022).
export const ownPlannerOrOwner =
  (path: string): Access =>
  ({ req }) => {
    if (isOwner(req.user)) return true
    if (req.user) return { [path]: { equals: req.user.id } }
    return false
  }

const deleteWeeks: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: 'planner-weeks',
    where: { planner: { equals: id } },
    overrideAccess: true,
    req,
  })
}

/**
 * One weekly planner per student (story 022). Writes go through the Server Actions in
 * `features/planner` (the owner edits, the student only ticks), so direct API writes are owner-only.
 */
export const Planners: CollectionConfig = {
  slug: 'planners',
  labels: { singular: 'Планер ученика', plural: 'Планеры учеников' },
  admin: { useAsTitle: 'baseDate', defaultColumns: ['student', 'baseDate', 'updatedAt'] },
  access: { read: ownPlannerOrOwner('student'), create: owner, update: owner, delete: owner },
  hooks: { beforeDelete: [deleteWeeks] },
  fields: [
    { name: 'student', type: 'relationship', relationTo: 'users', required: true, unique: true },
    {
      name: 'baseDate',
      type: 'text',
      required: true,
      label: 'Понедельник первой недели (YYYY-MM-DD)',
      validate: (value: string | null | undefined) =>
        typeof value === 'string' && isIsoDate(value) && mondayOf(value) === value
          ? true
          : 'Нужен понедельник в формате YYYY-MM-DD',
    },
  ],
}
