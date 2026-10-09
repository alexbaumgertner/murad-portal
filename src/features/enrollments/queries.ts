import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { contentDefaultLocale } from '@/i18n/locales'
import type { Enrollment, Program, SlotType } from '@/payload-types'

import { OPEN_STATUSES, TEST_NAMES, programDay, scoreLabel, type PlacementTest } from './shape'

export type ProgramView = {
  title: string
  levelFrom: string
  levelTo: string
  durationWeeks: number
  summary: string | null
  materials: Program['materials'] | null
  /** The week template: 7 days, each with 0–5 slots. */
  days: { slots: { name: string; minutes: number }[] }[]
}

export type StudyView =
  | { kind: 'none' }
  | {
      kind: 'assigned'
      /** `test` is null for Murad's own CEFR test (translated on the page). */
      placement: { test: string | null; score: string | null; cefr: string }
      program: ProgramView
    }
  | { kind: 'active'; program: ProgramView; day: number; totalDays: number }

function testLabel(placement: Enrollment['placement']): string | null {
  const test = placement.test as PlacementTest
  if (test === 'murad') return null
  if (test === 'other') return placement.testName?.trim() || null
  return TEST_NAMES[test]
}

function programView(program: Program): ProgramView {
  return {
    title: program.title,
    levelFrom: program.levelFrom,
    levelTo: program.levelTo,
    durationWeeks: program.durationWeeks,
    summary: program.summary ?? null,
    materials: program.materials ?? null,
    days: program.weekTemplate.map((day) => ({
      slots: (day.slots ?? []).flatMap((slot) => {
        const type = slot.slotType as SlotType | number
        if (typeof type !== 'object') return []
        return [{ name: type.name, minutes: slot.minMinutes ?? type.defaultMinMinutes }]
      }),
    })),
  }
}

/**
 * What /study shows the signed-in student. Read as her (`overrideAccess: false`): she only gets
 * her own enrollment, the placement note is stripped by field access, and the program only if
 * it is still published. Only display fields leave this function.
 */
export async function getStudyView(
  payload: Payload,
  student: TypedUser,
  locale: 'ru' | 'en',
): Promise<StudyView> {
  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { student: { equals: student.id }, status: { in: [...OPEN_STATUSES] } },
    sort: '-assignedAt',
    limit: 1,
    depth: 2,
    locale,
    fallbackLocale: contentDefaultLocale,
    overrideAccess: false,
    user: student,
  })
  const enrollment = docs[0]
  if (!enrollment || typeof enrollment.program !== 'object') return { kind: 'none' }
  const program = programView(enrollment.program)

  if (enrollment.status === 'assigned') {
    return {
      kind: 'assigned',
      placement: {
        test: testLabel(enrollment.placement),
        score: scoreLabel(enrollment.placement),
        cefr: enrollment.placement.cefr,
      },
      program,
    }
  }
  if (!enrollment.startDate || !enrollment.timezone) return { kind: 'none' }
  return {
    kind: 'active',
    program,
    day: programDay(enrollment.startDate, enrollment.timezone),
    totalDays: program.durationWeeks * 7,
  }
}
