import {
  Forbidden,
  ValidationError,
  type Access,
  type CollectionAfterChangeHook,
  type CollectionBeforeOperationHook,
  type CollectionBeforeValidateHook,
  type CollectionConfig,
  type FieldAccess,
  type Where,
} from 'payload'

import { isOwner, owner } from '@/access'
import {
  CAMBRIDGE_EXAMS,
  ENROLLMENT_STATUSES,
  MAX_NOTE,
  MAX_SCORE_TEXT,
  MAX_TEST_NAME,
  OPEN_STATUSES,
  PLACEMENT_TESTS,
  dateOnlyToISO,
  daysBetween,
  hasScore,
  isOpenStatus,
  isTakenAtValid,
  messages,
  scoreError,
  timeZoneOrDefault,
  todayIn,
} from '@/features/enrollments/shape'
import type { AnalyticsProps } from '@/lib/analytics'
import { sendAssigned } from '@/features/enrollments/send-assigned'
import { copyProgramPlan, deletePlan } from '@/features/student-plan/copy-plan'
import { LEVELS } from '@/features/programs/shape'
import { parseAddressForm } from '@/i18n/address-form'
import type { Enrollment } from '@/payload-types'

type Rel = number | { id: number } | null | undefined
type Placement = {
  test?: string | null
  score?: number | null
  exam?: string | null
  scoreText?: string | null
  testName?: string | null
}
type EnrollmentData = {
  id?: number
  student?: Rel
  program?: Rel
  status?: string
  assignedAt?: string | null
  startDate?: string | null
  timezone?: string | null
  placement?: Placement
}

const idOf = (value: Rel) => (typeof value === 'object' && value ? value.id : (value ?? undefined))

const fail = (path: string, message: string): never => {
  throw new ValidationError({ collection: 'enrollments', errors: [{ path, message }] })
}

// Placement, program and history belong to the owner; a student never writes them.
const ownerOnly: FieldAccess = ({ req }) => isOwner(req.user)

// Owner: everything. Student: her own enrollments only. Anonymous: nothing (403).
const ownOrOwner: Access = ({ req }) => {
  if (isOwner(req.user)) return true
  if (req.user) return { student: { equals: req.user.id } }
  return false
}

// The only write a student makes is «Начать» on her own enrollment while it is still assigned.
const startOwnOrOwner: Access = ({ req }) => {
  if (isOwner(req.user)) return true
  if (req.user) {
    const where: Where = { student: { equals: req.user.id }, status: { equals: 'assigned' } }
    return where
  }
  return false
}

/** What a student may send when she starts; anything else is refused with 403, not ignored. */
const STUDENT_KEYS = new Set(['status', 'timezone', 'startDate'])

// Runs on the raw input, before field access silently drops what the student may not write.
const refuseForeignKeys: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if (operation !== 'update' || !req.user || isOwner(req.user)) return args
  const data = (args as { data?: Record<string, unknown> }).data ?? {}
  if (Object.keys(data).some((key) => !STUDENT_KEYS.has(key))) throw new Forbidden(req.t)
  return args
}

/** «Начать»: the server, not the browser, decides the date — today in her zone (D-SP-3). */
function startData(data: EnrollmentData, now = new Date()): EnrollmentData {
  if (data.status !== 'active') throw new Forbidden()
  const timezone = timeZoneOrDefault(data.timezone)
  return { status: 'active', timezone, startDate: dateOnlyToISO(todayIn(timezone, now)) }
}

/** Keeps only the placement fields of the chosen test, so a hidden score never lingers. */
function normalizePlacement(placement: Placement | undefined): Placement | undefined {
  if (!placement) return placement
  const next = { ...placement }
  if (!hasScore(next.test)) next.score = null
  if (next.test !== 'cambridge') next.exam = null
  if (next.test !== 'other') {
    next.scoreText = null
    next.testName = null
  }
  return next
}

const validateRules: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const incoming = (data ?? {}) as EnrollmentData
  const original = originalDoc as EnrollmentData | undefined

  if (!isOwner(req.user) && req.user) {
    // Collection access already limits a student to her own, still assigned enrollment.
    return { ...incoming, ...startData(incoming) }
  }

  const next: EnrollmentData = { ...incoming }
  if (operation === 'create') {
    next.status = 'assigned'
    next.startDate = null
    next.timezone = null
    next.assignedAt = new Date().toISOString()
  } else if (incoming.status !== undefined && incoming.status !== original?.status) {
    // The owner can only close a program; starting (and later pausing) is the student's (D-SP-3).
    if (incoming.status !== 'finished') fail('status', messages.statusChange)
  }
  if (incoming.placement) next.placement = normalizePlacement(incoming.placement)

  const merged: EnrollmentData = { ...original, ...next }
  const studentId = idOf(merged.student)
  const programId = idOf(merged.program)

  if (studentId != null && (operation === 'create' || idOf(original?.student) !== studentId)) {
    const student = await req.payload.findByID({
      collection: 'users',
      id: studentId,
      depth: 0,
      overrideAccess: true, // integrity check, not a visitor read
      req,
      disableErrors: true,
    })
    if (student?.role !== 'student') fail('student', messages.notStudent)
  }

  if (programId != null && (operation === 'create' || idOf(original?.program) !== programId)) {
    if (operation === 'update' && original?.status !== 'assigned') {
      fail('program', messages.programLocked)
    }
    const program = await req.payload.findByID({
      collection: 'programs',
      id: programId,
      depth: 0,
      overrideAccess: true,
      req,
      disableErrors: true,
    })
    if (program?.status !== 'published') fail('program', messages.notPublished)
  }

  // D-SP-6: one assigned/active/paused program per student. Finished ones stay as history.
  if (studentId != null && isOpenStatus(merged.status)) {
    const { docs } = await req.payload.find({
      collection: 'enrollments',
      where: {
        student: { equals: studentId },
        status: { in: [...OPEN_STATUSES] },
        ...(operation === 'update' && original?.id != null
          ? { id: { not_equals: original.id } }
          : {}),
      },
      depth: 1,
      limit: 1,
      overrideAccess: true,
      req,
    })
    const other = docs[0]
    if (other) {
      const title = typeof other.program === 'object' ? other.program.title : String(other.program)
      fail('student', messages.alreadyOpen(title))
    }
  }
  return next
}

// Analytics is server-only; load it lazily so the Payload CLI can still read this config. Outside
// Next (scripts, test seeding) there is no visitor request to count.
async function trackSafe<E extends 'program_assigned' | 'program_started'>(
  req: { headers: Headers },
  event: E,
  props: AnalyticsProps<E>,
) {
  if (!process.env.NEXT_RUNTIME) return
  try {
    const { track } = await import('@/lib/analytics')
    await track(event, props, async () => req.headers)
  } catch (error) {
    console.warn('[enrollments] analytics skipped', error)
  }
}

const afterAssign: CollectionAfterChangeHook = async ({ doc, operation, previousDoc, req }) => {
  const enrollment = doc as Enrollment
  const program = await req.payload.findByID({
    collection: 'programs',
    id: idOf(enrollment.program) as number,
    depth: 0,
    overrideAccess: true,
    req,
  })

  if (operation === 'create') {
    const student = await req.payload.findByID({
      collection: 'users',
      id: idOf(enrollment.student) as number,
      depth: 0,
      overrideAccess: true,
      req,
    })
    // A failed email throws and rolls the assignment back, like the invite (story 011).
    await sendAssigned(
      req.payload,
      student.email,
      { from: program.levelFrom, to: program.levelTo },
      student.locale === 'en' ? 'en' : 'ru',
      parseAddressForm(student.addressForm),
    )
    await trackSafe(req, 'program_assigned', {
      programSlug: program.slug,
      levelFrom: program.levelFrom,
      levelTo: program.levelTo,
      placementTest: enrollment.placement.test,
      placementCefr: enrollment.placement.cefr,
    })
  }

  const prev = previousDoc as EnrollmentData | undefined
  if (operation === 'update' && prev?.status === 'assigned' && enrollment.status === 'active') {
    await trackSafe(req, 'program_started', {
      programSlug: program.slug,
      levelFrom: program.levelFrom,
      levelTo: program.levelTo,
      daysFromAssignToStart: Math.max(
        0,
        daysBetween(enrollment.assignedAt ?? '', enrollment.startDate ?? ''),
      ),
    })
  }
  return doc
}

// Story 018 (D-SP-5): assigning copies the program's default plan into the student's own plan, in
// the assignment's transaction (`req`). Changing the program before the start replaces the copy;
// later edits of the pool or the program plan never reach it.
const copyPlanOnAssign: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  const enrollment = doc as Enrollment
  const programId = idOf(enrollment.program) as number
  if (operation === 'create') {
    await copyProgramPlan(req, enrollment.id, programId)
  } else if (idOf((previousDoc as EnrollmentData | undefined)?.program) !== programId) {
    await deletePlan(req, enrollment.id)
    await copyProgramPlan(req, enrollment.id, programId)
  }
  return doc
}

export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  labels: { singular: 'Назначение', plural: 'Назначения' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['student', 'program', 'status', 'assignedAt', 'startDate'],
    description:
      'Программа ученика после теста уровня. Назначайте со страницы ученика (Users → ученик).',
  },
  access: {
    read: ownOrOwner,
    create: owner,
    update: startOwnOrOwner,
    delete: owner,
  },
  hooks: {
    beforeOperation: [refuseForeignKeys],
    beforeValidate: [validateRules],
    afterChange: [copyPlanOnAssign, afterAssign],
    // The plan's `enrollment` column is required: delete the plan before the database would null it.
    beforeDelete: [({ id, req }) => deletePlan(req, Number(id))],
  },
  fields: [
    {
      name: 'student',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      filterOptions: { role: { equals: 'student' } },
      access: { update: ownerOnly },
    },
    {
      name: 'placement',
      type: 'group',
      label: 'Тест уровня',
      access: { update: ownerOnly },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'test',
              type: 'select',
              required: true,
              defaultValue: 'murad',
              options: [
                { label: 'Мурад (CEFR)', value: 'murad' },
                { label: 'IELTS', value: 'ielts' },
                { label: 'TOEFL iBT', value: 'toefl' },
                { label: 'Cambridge', value: 'cambridge' },
                { label: 'Duolingo English Test', value: 'duolingo' },
                { label: 'PTE Academic', value: 'pte' },
                { label: 'EF SET', value: 'efset' },
                { label: 'Другой', value: 'other' },
              ] satisfies { label: string; value: (typeof PLACEMENT_TESTS)[number] }[],
            },
            {
              name: 'cefr',
              type: 'select',
              required: true,
              label: 'Уровень CEFR',
              options: [...LEVELS],
              admin: { description: 'Вводится вручную, без автоматического пересчёта.' },
            },
            {
              name: 'takenAt',
              type: 'date',
              required: true,
              label: 'Дата теста',
              admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy' } },
              validate: (value: unknown) => (isTakenAtValid(value) ? true : messages.takenAtFuture),
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'testName',
              type: 'text',
              label: 'Название теста',
              maxLength: MAX_TEST_NAME,
              admin: { condition: (_, sibling) => sibling?.test === 'other' },
              validate: (value: unknown, { siblingData }: { siblingData: Placement }) =>
                siblingData?.test !== 'other' ||
                (typeof value === 'string' &&
                  value.trim().length > 0 &&
                  value.length <= MAX_TEST_NAME)
                  ? true
                  : messages.testName,
            },
            {
              name: 'scoreText',
              type: 'text',
              label: 'Результат',
              maxLength: MAX_SCORE_TEXT,
              admin: { condition: (_, sibling) => sibling?.test === 'other' },
              validate: (value: unknown) =>
                value == null || (typeof value === 'string' && value.length <= MAX_SCORE_TEXT)
                  ? true
                  : messages.scoreText,
            },
            {
              name: 'exam',
              type: 'select',
              label: 'Экзамен',
              options: [...CAMBRIDGE_EXAMS],
              admin: { condition: (_, sibling) => sibling?.test === 'cambridge' },
              validate: (value: unknown, { siblingData }: { siblingData: Placement }) =>
                siblingData?.test !== 'cambridge' ||
                (CAMBRIDGE_EXAMS as readonly unknown[]).includes(value)
                  ? true
                  : messages.examRequired,
            },
            {
              name: 'score',
              type: 'number',
              label: 'Балл',
              // AC 12: Murad's CEFR test has no score.
              admin: { condition: (_, sibling) => hasScore(sibling?.test) },
              validate: (value: unknown, { siblingData }: { siblingData: Placement }) =>
                scoreError(siblingData?.test, value) ?? true,
            },
          ],
        },
        {
          name: 'note',
          type: 'textarea',
          label: 'Заметка (видит только владелец)',
          maxLength: MAX_NOTE,
          // D-SP-9: the private note never reaches the student, through any API.
          access: { read: ownerOnly, create: ownerOnly, update: ownerOnly },
        },
      ],
    },
    {
      name: 'program',
      type: 'relationship',
      relationTo: 'programs',
      required: true,
      index: true,
      // AC 9: drafts are not offered; the hook refuses them through the API as well.
      filterOptions: { status: { equals: 'published' } },
      access: { update: ownerOnly },
      admin: { description: 'Только опубликованные. Сменить можно, пока ученик не начал.' },
    },
    {
      name: 'levelWarning',
      type: 'ui',
      admin: {
        components: {
          Field:
            '/components/admin/PlacementLevelWarning/PlacementLevelWarning#PlacementLevelWarning',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'assigned',
      index: true,
      options: ENROLLMENT_STATUSES.map((value) => ({ label: value, value })),
      admin: {
        position: 'sidebar',
        description: 'Начинает ученик («Начать»). Владелец может только завершить.',
      },
    },
    {
      name: 'assignedAt',
      type: 'date',
      access: { create: ownerOnly, update: ownerOnly },
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'startDate',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'День 1 — день, когда ученик нажал «Начать».',
        date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy' },
      },
    },
    {
      name: 'timezone',
      type: 'text',
      maxLength: 64,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'pauses',
      type: 'array',
      access: { create: ownerOnly, update: ownerOnly },
      admin: { readOnly: true, description: 'Паузы появятся в истории 017.' },
      fields: [
        { name: 'from', type: 'date', required: true },
        { name: 'to', type: 'date' },
      ],
    },
  ],
}
