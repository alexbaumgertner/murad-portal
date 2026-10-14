'use server'

import { headers } from 'next/headers'
import type { z } from 'zod'

import { currentUser } from '@/features/auth/current-user'
import { track } from '@/lib/analytics'
import { captureServerError, monitorAction } from '@/lib/monitoring/server'
import { getPayloadClient } from '@/lib/payload'

import {
  createPlannerSchema,
  importSchema,
  plannerIdSchema,
  progressSettingsSchema,
  saveAppearanceSchema,
  saveHeaderSchema,
  saveNoteSchema,
  setDoneSchema,
  setTextSchema,
  weekIdSchema,
  type ExportState,
  type PlannerActionState,
} from './schema'
import { parseBackup } from './backup'
import * as service from './service'

type Run<S extends z.ZodType> = (
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>,
  input: z.infer<S>,
) => Promise<service.Result>

/** Parse with Zod → derive the signed-in user → call the service. The browser never names a role. */
async function run<S extends z.ZodType>(
  name: string,
  schema: S,
  input: unknown,
  work: Run<S>,
): Promise<PlannerActionState> {
  return monitorAction(name, async () => {
    const parsed = schema.safeParse(input)
    if (!parsed.success) return { status: 'error', error: 'invalid_input' }
    const payload = await getPayloadClient()
    const user = await currentUser(payload, await headers())
    if (!user) return { status: 'error', error: 'unauthorized' }
    try {
      const result = await work(payload, user, parsed.data)
      return result.ok ? { status: 'success' } : { status: 'error', error: result.error }
    } catch (error) {
      console.error(`[planner] ${name} failed`, error)
      await captureServerError(error, 'planner')
      return { status: 'error', error: 'server' }
    }
  })
}

export async function createPlannerAction(input: unknown): Promise<PlannerActionState> {
  return run('createPlannerAction', createPlannerSchema, input, (p, u, i) =>
    service.createPlanner(p, u, i),
  )
}

export async function addWeekAction(input: unknown): Promise<PlannerActionState> {
  return run('addWeekAction', plannerIdSchema, input, (p, u, i) =>
    service.addWeek(p, u, i.plannerId),
  )
}

export async function deleteWeekAction(input: unknown): Promise<PlannerActionState> {
  return run('deleteWeekAction', weekIdSchema, input, (p, u, i) =>
    service.deleteWeek(p, u, i.weekId),
  )
}

export async function addRowAction(input: unknown): Promise<PlannerActionState> {
  return run('addRowAction', weekIdSchema, input, (p, u, i) => service.addRow(p, u, i.weekId))
}

export async function removeRowAction(input: unknown): Promise<PlannerActionState> {
  return run('removeRowAction', weekIdSchema, input, (p, u, i) => service.removeRow(p, u, i.weekId))
}

export async function setCellTextAction(input: unknown): Promise<PlannerActionState> {
  return run('setCellTextAction', setTextSchema, input, (p, u, i) => service.setCellText(p, u, i))
}

export async function setDoneAction(input: unknown): Promise<PlannerActionState> {
  return run('setDoneAction', setDoneSchema, input, async (p, u, i) => {
    const result = await service.setDone(p, u, i)
    if (result.ok) await track('planner_task_ticked', { done: i.done }, async () => headers())
    return result
  })
}

export async function saveProgressSettingsAction(input: unknown): Promise<PlannerActionState> {
  return run('saveProgressSettingsAction', progressSettingsSchema, input, (p, u, i) =>
    service.saveProgressSettings(p, u, i),
  )
}

export async function saveHeaderAction(input: unknown): Promise<PlannerActionState> {
  return run('saveHeaderAction', saveHeaderSchema, input, (p, u, i) => service.saveHeader(p, u, i))
}

export async function saveNoteAction(input: unknown): Promise<PlannerActionState> {
  return run('saveNoteAction', saveNoteSchema, input, (p, u, i) => service.saveNote(p, u, i))
}

export async function saveAppearanceAction(input: unknown): Promise<PlannerActionState> {
  return run('saveAppearanceAction', saveAppearanceSchema, input, (p, u, i) =>
    service.saveAppearance(p, u, i),
  )
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')

/** The signed-in owner or student exports a planner she may read (a student: only her own). */
export async function exportPlannerAction(input: unknown): Promise<ExportState> {
  return monitorAction('exportPlannerAction', async () => {
    const parsed = plannerIdSchema.safeParse(input)
    if (!parsed.success) return { status: 'error', error: 'invalid_input' }
    const payload = await getPayloadClient()
    const user = await currentUser(payload, await headers())
    if (!user) return { status: 'error', error: 'unauthorized' }
    try {
      const result = await service.exportPlanner(payload, user, parsed.data.plannerId)
      if (!result.ok) return { status: 'error', error: result.error }
      const date = result.backup.exportedAt.slice(0, 10)
      return {
        status: 'success',
        json: JSON.stringify(result.backup, null, 2),
        filename: `study-plan-${slug(result.studentName) || 'planner'}-${date}.json`,
      }
    } catch (error) {
      console.error('[planner] export failed', error)
      await captureServerError(error, 'planner')
      return { status: 'error', error: 'server' }
    }
  })
}

export async function importPlannerAction(input: unknown): Promise<PlannerActionState> {
  return run('importPlannerAction', importSchema, input, async (p, u, i) => {
    const backup = parseBackup(i.json)
    if (!backup.ok) return { ok: false, error: backup.error }
    return service.importPlanner(p, u, i.plannerId, backup.data)
  })
}

export async function resetPlannerAction(input: unknown): Promise<PlannerActionState> {
  return run('resetPlannerAction', plannerIdSchema, input, (p, u, i) =>
    service.resetPlanner(p, u, i.plannerId),
  )
}
