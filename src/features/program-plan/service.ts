import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { isOwner } from '@/access'

import { planWeekCopy, positionKey, type PlanCopyItem } from './shape'
import type { CopyWeekInput } from './schema'

export type CopyWeekResult =
  | { ok: true; copied: number; skipped: number }
  | { ok: false; error: 'invalid_range' | 'not_found' }

const asPlanItem = (doc: {
  week: number
  day: number
  order: number
  task: number | { id: number }
}): PlanCopyItem => ({
  week: doc.week,
  day: doc.day,
  order: doc.order,
  task: typeof doc.task === 'object' ? doc.task.id : doc.task,
})

/**
 * Copies one week of a program's default plan into the weeks `toFirst`…`toLast`. Places that are
 * already taken are skipped, never overwritten. Runs as the owner (`overrideAccess: false`), so the
 * collection's own access and rules apply, and in one transaction: either every item lands or none.
 */
export async function copyWeek(
  payload: Payload,
  owner: TypedUser,
  { programId, fromWeek, toFirst, toLast }: CopyWeekInput,
): Promise<CopyWeekResult> {
  if (!isOwner(owner)) throw new Error('Only the owner can copy a plan week')
  const program = await payload
    .findByID({
      collection: 'programs',
      id: programId,
      depth: 0,
      overrideAccess: false,
      user: owner,
    })
    .catch(() => null)
  if (!program) return { ok: false, error: 'not_found' }

  const last = program.durationWeeks
  const inProgram = (week: number) => week >= 1 && week <= last
  if (
    !inProgram(fromWeek) ||
    !inProgram(toFirst) ||
    !inProgram(toLast) ||
    toFirst > toLast ||
    (fromWeek >= toFirst && fromWeek <= toLast)
  ) {
    return { ok: false, error: 'invalid_range' }
  }

  const { docs } = await payload.find({
    collection: 'program-plan-items',
    where: { program: { equals: programId }, week: { greater_than_equal: fromWeek } },
    sort: ['week', 'day', 'order'],
    pagination: false,
    depth: 0,
    overrideAccess: false,
    user: owner,
  })
  const items = docs.map(asPlanItem)
  const targetWeeks = Array.from({ length: toLast - toFirst + 1 }, (_, i) => toFirst + i)
  const occupied = new Set(
    items.filter((item) => item.week >= toFirst && item.week <= toLast).map(positionKey),
  )
  const { create, skipped } = planWeekCopy(
    items.filter((item) => item.week === fromWeek),
    targetWeeks,
    occupied,
  )

  // `payload.db` transactions, not the `payload` helpers: this file is crawled by the browser tests.
  const transactionID = await payload.db.beginTransaction()
  try {
    for (const item of create) {
      await payload.create({
        collection: 'program-plan-items',
        data: { program: programId, ...item },
        depth: 0,
        overrideAccess: false,
        user: owner,
        req: { transactionID: transactionID ?? undefined },
      })
    }
    if (transactionID) await payload.db.commitTransaction(transactionID)
  } catch (error) {
    if (transactionID) await payload.db.rollbackTransaction(transactionID)
    throw error
  }
  return { ok: true, copied: create.length, skipped }
}
