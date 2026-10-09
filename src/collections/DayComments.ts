import type { Access, CollectionBeforeChangeHook, CollectionConfig, FieldHook } from 'payload'

import { isOwner, owner } from '@/access'
import { MAX_COMMENT_LENGTH } from '@/features/day-comments/shape'
import { programDayOfDate } from '@/features/study-today/shape'
import type { Enrollment } from '@/payload-types'

// Owner: everything. Student: only the comments of her own enrollments. Anonymous: 403. Never public.
const ownCommentsOrOwner: Access = ({ req }) => {
  if (isOwner(req.user)) return true
  if (req.user) return { 'enrollment.student': { equals: req.user.id } }
  return false
}

const idOf = (value: number | { id: number } | null | undefined) =>
  typeof value === 'object' && value ? value.id : (value ?? undefined)

const CACHE = 'dayCommentEnrollments'

/** The enrollment of a comment with its student and program, read once per request (list rows share it). */
async function enrollmentOf(
  req: Parameters<FieldHook>[0]['req'],
  id: number | undefined,
): Promise<Enrollment | null> {
  if (id == null) return null
  const cache = (req.context[CACHE] ??= new Map<number, Promise<Enrollment | null>>()) as Map<
    number,
    Promise<Enrollment | null>
  >
  let found = cache.get(id)
  if (!found) {
    found = req.payload
      .findByID({
        collection: 'enrollments',
        id,
        depth: 1,
        overrideAccess: true, // display values for a row the caller already may read
        disableErrors: true,
        req,
      })
      .then((doc) => doc ?? null)
    cache.set(id, found)
  }
  return found
}

/** The student is a copy of the enrollment's, so the list can be filtered by student in /admin. */
const copyStudent: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const enrollmentId = idOf(data.enrollment ?? originalDoc?.enrollment)
  const enrollment = await req.payload.findByID({
    collection: 'enrollments',
    id: enrollmentId as number,
    depth: 0,
    overrideAccess: true, // integrity copy, not a visitor read
    disableErrors: true,
    req,
  })
  return { ...data, student: idOf(enrollment?.student) }
}

/**
 * What a student writes to her program days (story 016): a question, what was hard. A student only
 * reads her own; every write goes through the Server Action in `features/day-comments`, which
 * derives the enrollment from the signed-in student and refuses future days, so a direct API
 * write is refused (403). Murad reads all of them here, newest first.
 */
export const DayComments: CollectionConfig = {
  slug: 'day-comments',
  labels: { singular: 'Комментарий ученика', plural: 'Комментарии учеников' },
  admin: {
    useAsTitle: 'text',
    defaultColumns: ['studentName', 'programTitle', 'programDay', 'date', 'text'],
    description:
      'Что ученики пишут к своим дням. Пишет только сам ученик, на сайте; здесь — читать.',
  },
  defaultSort: ['-date', '-updatedAt'],
  access: {
    read: ownCommentsOrOwner,
    create: owner,
    update: owner,
    delete: owner,
  },
  hooks: { beforeChange: [copyStudent] },
  fields: [
    {
      name: 'studentName',
      type: 'text',
      label: 'Ученик',
      virtual: true,
      admin: { readOnly: true },
      hooks: {
        afterRead: [
          async ({ siblingData, req }) => {
            const enrollment = await enrollmentOf(req, idOf(siblingData.enrollment))
            const student = enrollment?.student
            return typeof student === 'object' ? student.name || student.email : null
          },
        ],
      },
    },
    {
      name: 'programTitle',
      type: 'text',
      label: 'Программа',
      virtual: true,
      admin: { readOnly: true },
      hooks: {
        afterRead: [
          async ({ siblingData, req }) => {
            const enrollment = await enrollmentOf(req, idOf(siblingData.enrollment))
            return typeof enrollment?.program === 'object' ? enrollment.program.title : null
          },
        ],
      },
    },
    {
      name: 'programDay',
      type: 'number',
      label: 'День программы',
      virtual: true,
      admin: { readOnly: true },
      hooks: {
        afterRead: [
          async ({ siblingData, req }) => {
            const enrollment = await enrollmentOf(req, idOf(siblingData.enrollment))
            if (!enrollment?.startDate || !siblingData.date) return null
            return programDayOfDate(
              enrollment.startDate.slice(0, 10),
              String(siblingData.date).slice(0, 10),
            )
          },
        ],
      },
    },
    {
      name: 'enrollment',
      type: 'relationship',
      relationTo: 'enrollments',
      required: true,
      index: true,
    },
    {
      name: 'student',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      label: 'Ученик (для фильтра)',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
      label: 'Дата',
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy' } },
    },
    {
      name: 'text',
      type: 'textarea',
      required: true,
      label: 'Комментарий',
      maxLength: MAX_COMMENT_LENGTH,
    },
  ],
  indexes: [{ fields: ['enrollment', 'date'], unique: true }],
}
