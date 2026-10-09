'use server'

import { headers } from 'next/headers'

import { currentStudent } from '@/features/auth/current-user'
import { track } from '@/lib/analytics'
import { captureServerError, monitorAction } from '@/lib/monitoring/server'
import { getPayloadClient } from '@/lib/payload'

import { emptySchema, type PauseActionState } from './schema'
import { pauseProgram, resumeProgram, type PauseResult } from './service'

async function run(
  name: string,
  event: 'program_paused' | 'program_resumed',
  work: (
    payload: Awaited<ReturnType<typeof getPayloadClient>>,
    student: NonNullable<Awaited<ReturnType<typeof currentStudent>>>,
  ) => Promise<PauseResult>,
): Promise<PauseActionState> {
  return monitorAction(name, async () => {
    const payload = await getPayloadClient()
    const student = await currentStudent(payload, await headers())
    if (!student) return { status: 'error', error: 'unauthorized' }
    try {
      const result = await work(payload, student)
      if (!result.ok) return { status: 'error', error: result.error }
      // Only after the change is saved, and only when this call made it (a double tap counts once).
      if (result.changed) {
        await track(event, { programSlug: result.programSlug }, async () => headers())
      }
      return { status: 'success' }
    } catch (error) {
      console.error(`[program-pause] ${name} failed`, error)
      await captureServerError(error, 'program-pause')
      return { status: 'error', error: 'server' }
    }
  })
}

/** «Пауза»: today starts a pause on the signed-in student's own program. */
export async function pauseProgramAction(input: unknown = {}): Promise<PauseActionState> {
  if (!emptySchema.safeParse(input).success) return { status: 'error', error: 'invalid_input' }
  return run('pauseProgramAction', 'program_paused', (payload, student) =>
    pauseProgram(payload, student),
  )
}

/** «Продолжить»: ends the open pause; today is the program day she stopped on. */
export async function resumeProgramAction(input: unknown = {}): Promise<PauseActionState> {
  if (!emptySchema.safeParse(input).success) return { status: 'error', error: 'invalid_input' }
  return run('resumeProgramAction', 'program_resumed', (payload, student) =>
    resumeProgram(payload, student),
  )
}
