// Copying a program's default plan into a student's personal plan (story 018, D-SP-5).
// Framework-free: the enrollments collection hook calls it, and Payload's CLI loads that config.

import type { PayloadRequest } from 'payload'

/** Set on `req.context` while the copy runs: the rows come from a validated plan. */
export const PLAN_COPY = 'studentPlanCopy'

/**
 * Copies every item of the program's default plan, with the pool text as it is now, into the
 * enrollment's plan. Runs on the caller's `req`, so it shares the assignment's transaction: if
 * one row fails, the assignment is rolled back with it. Returns the number of copied tasks.
 */
export async function copyProgramPlan(
  req: PayloadRequest,
  enrollmentId: number,
  programId: number,
): Promise<number> {
  const { docs } = await req.payload.find({
    collection: 'program-plan-items',
    where: { program: { equals: programId } },
    sort: ['week', 'day', 'order'],
    pagination: false,
    depth: 1,
    select: { week: true, day: true, order: true, task: true },
    populate: { 'task-pool': { text: true } },
    overrideAccess: true, // the owner's own write, not a visitor read
    req,
  })

  try {
    for (const item of docs) {
      if (typeof item.task !== 'object' || !item.task) continue
      await req.payload.create({
        collection: 'student-assignments',
        data: {
          enrollment: enrollmentId,
          week: item.week,
          day: item.day,
          order: item.order,
          text: { ru: item.task.text.ru, en: item.task.text.en ?? null },
          sourceTask: item.task.id,
          editedByOwner: false,
        },
        depth: 0,
        overrideAccess: true,
        context: { [PLAN_COPY]: true },
        req,
      })
    }
  } finally {
    delete req.context[PLAN_COPY]
  }
  return docs.length
}

/** Removes the whole personal plan of an enrollment (same transaction as the caller). */
export async function deletePlan(req: PayloadRequest, enrollmentId: number): Promise<void> {
  await req.payload.delete({
    collection: 'student-assignments',
    where: { enrollment: { equals: enrollmentId } },
    overrideAccess: true,
    req,
  })
}
