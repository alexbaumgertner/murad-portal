import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { isOwner } from '@/access'
import { programDayOnDate, type EnrollmentStatus } from '@/features/enrollments/shape'
import { templateOf } from '@/features/study-today/queries'
import {
  firstDayOfWeek,
  weekGrid,
  weekOf,
  type GridCell,
  type TemplateDay,
} from '@/features/study-today/shape'
import { contentDefaultLocale } from '@/i18n/locales'
import type { Enrollment, Program, User } from '@/payload-types'

/** The fields `ENROLLMENT_FIELDS` selects: no placement, no timestamps. */
type Row = Pick<
  Enrollment,
  'id' | 'student' | 'program' | 'status' | 'assignedAt' | 'startDate' | 'timezone' | 'pauses'
>

import { summarize, type LogDoc, type StudentSummary } from './shape'

export type StudentDetail = {
  summary: StudentSummary
  /** The current program week and the one before it, in this order. */
  weeks: { week: number; cells: GridCell[] }[]
  /** Newest first; `programDay` is `null` when the program is not started. */
  comments: { date: string; programDay: number | null; text: string }[]
}

const COMMENTS_SHOWN = 20
// What the page needs of an enrollment: no placement, so its private note never enters memory.
const ENROLLMENT_FIELDS = {
  student: true,
  program: true,
  status: true,
  assignedAt: true,
  startDate: true,
  timezone: true,
  pauses: true,
} as const

function requireOwner(user: TypedUser): void {
  if (!isOwner(user)) throw new Error('forbidden')
}

const STATUS_ORDER: Record<EnrollmentStatus, number> = {
  active: 0,
  paused: 1,
  assigned: 2,
  finished: 3,
}

function facts(enrollment: Row) {
  const program = enrollment.program as Program
  const student = enrollment.student as User
  return {
    enrollment: {
      id: enrollment.id,
      status: enrollment.status as EnrollmentStatus,
      name: student.name?.trim() || student.email,
      programTitle: program.title,
      levelFrom: program.levelFrom,
      levelTo: program.levelTo,
      durationWeeks: program.durationWeeks,
      startDate: enrollment.startDate ?? null,
      timezone: enrollment.timezone ?? null,
      pauses: enrollment.pauses,
    },
    template: templateOf(program),
  }
}

const isPopulated = (enrollment: Row) =>
  typeof enrollment.program === 'object' && typeof enrollment.student === 'object'

/**
 * Story 019: every student's numbers for the owner. Read as the owner (`overrideAccess: false`),
 * and refused for anyone else: a student's own access would show her one row, which is not this
 * page. Read-only; an active program that is over is shown as finished, not closed here.
 */
export async function listStudentSummaries(
  payload: Payload,
  user: TypedUser,
  locale: 'ru' | 'en',
  now: Date = new Date(),
): Promise<StudentSummary[]> {
  return (await loadSummaries(payload, user, locale, now)).map(({ summary }) => summary)
}

/** Story 030: the same summaries keyed by student, so the dashboard can join them to planners. */
export async function listProgramSummariesByStudent(
  payload: Payload,
  user: TypedUser,
  locale: 'ru' | 'en',
  now: Date = new Date(),
): Promise<Map<number, StudentSummary>> {
  const byStudent = new Map<number, StudentSummary>()
  // Sorted by status already: the first enrollment of a student is the one that matters most.
  for (const { studentId, summary } of await loadSummaries(payload, user, locale, now)) {
    if (!byStudent.has(studentId)) byStudent.set(studentId, summary)
  }
  return byStudent
}

async function loadSummaries(
  payload: Payload,
  user: TypedUser,
  locale: 'ru' | 'en',
  now: Date,
): Promise<{ studentId: number; summary: StudentSummary }[]> {
  requireOwner(user)
  const { docs } = await payload.find({
    collection: 'enrollments',
    pagination: false,
    depth: 2,
    select: ENROLLMENT_FIELDS,
    locale,
    fallbackLocale: contentDefaultLocale,
    overrideAccess: false,
    user,
  })
  const enrollments = docs.filter(isPopulated)
  const logs = await payload.find({
    collection: 'slot-logs',
    where: { enrollment: { in: enrollments.map((enrollment) => enrollment.id) } },
    pagination: false,
    depth: 0,
    select: { enrollment: true, date: true, slotIndex: true, minutes: true, completed: true },
    overrideAccess: false,
    user,
  })
  const byEnrollment = new Map<number, LogDoc[]>()
  for (const log of logs.docs) {
    const id = log.enrollment as number
    byEnrollment.set(id, [...(byEnrollment.get(id) ?? []), log])
  }

  return enrollments
    .map((enrollment) => ({
      studentId: (enrollment.student as User).id,
      summary: summarize({
        ...facts(enrollment),
        logs: byEnrollment.get(enrollment.id) ?? [],
        now,
      }),
    }))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.summary.status] - STATUS_ORDER[b.summary.status] ||
        a.summary.name.localeCompare(b.summary.name, locale),
    )
}

function gridsOf(summary: StudentSummary, template: TemplateDay[], durationWeeks: number) {
  if (summary.today == null || summary.startDate == null) return []
  // Past the last day the program is over: show its last week, not a week that does not exist.
  const week = Math.min(weekOf(Math.max(summary.today, 1)), durationWeeks)
  return [week - 1, week]
    .filter((number) => number >= 1)
    .map((number) => ({
      week: number,
      cells: weekGrid({
        week: number,
        startDate: summary.startDate!,
        today: Math.max(summary.today!, firstDayOfWeek(1)),
        template,
        progress: summary.progress,
        pauses: summary.pauses,
        paused: summary.status === 'paused',
      }),
    }))
}

/** One student's page: her numbers, the grid of this and the previous week, her latest comments. */
export async function getStudentDetail(
  payload: Payload,
  user: TypedUser,
  enrollmentId: number,
  locale: 'ru' | 'en',
  now: Date = new Date(),
): Promise<StudentDetail | null> {
  requireOwner(user)
  const enrollment = await payload.findByID({
    collection: 'enrollments',
    id: enrollmentId,
    depth: 2,
    select: ENROLLMENT_FIELDS,
    locale,
    fallbackLocale: contentDefaultLocale,
    overrideAccess: false,
    user,
    disableErrors: true,
  })
  if (!enrollment || !isPopulated(enrollment)) return null

  const [logs, comments] = await Promise.all([
    payload.find({
      collection: 'slot-logs',
      where: { enrollment: { equals: enrollment.id } },
      pagination: false,
      depth: 0,
      select: { date: true, slotIndex: true, minutes: true, completed: true },
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'day-comments',
      where: { enrollment: { equals: enrollment.id } },
      sort: '-date',
      limit: COMMENTS_SHOWN,
      depth: 0,
      select: { date: true, text: true },
      overrideAccess: false,
      user,
    }),
  ])

  const { enrollment: base, template } = facts(enrollment)
  const summary = summarize({ enrollment: base, template, logs: logs.docs, now })
  return {
    summary,
    weeks: gridsOf(summary, template, base.durationWeeks),
    comments: comments.docs.map((comment) => {
      const date = comment.date.slice(0, 10)
      return {
        date,
        programDay:
          summary.startDate == null
            ? null
            : programDayOnDate(summary.startDate, date, summary.pauses),
        text: comment.text,
      }
    }),
  }
}
