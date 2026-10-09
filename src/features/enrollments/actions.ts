'use server'

import { headers } from 'next/headers'

import { currentStudent } from '@/features/auth/current-user'
import { captureServerError, monitorAction } from '@/lib/monitoring/server'
import { getPayloadClient } from '@/lib/payload'

import { startSchema, type StartState } from './schema'
import { startEnrollment } from './service'

/** «Начать» on /study. Analytics (`program_started`) fires in the collection hook, once. */
export async function startProgramAction(
  _prev: StartState,
  formData: FormData,
): Promise<StartState> {
  return monitorAction('startProgramAction', async () => {
    const payload = await getPayloadClient()
    const student = await currentStudent(payload, await headers())
    if (!student) return { status: 'error', error: 'unauthorized' }

    // Only the zone is read: which enrollment to start is never taken from the browser.
    const parsed = startSchema.safeParse({ timezone: String(formData.get('timezone') ?? '') })
    if (!parsed.success) return { status: 'error', error: 'invalid_timezone' }

    try {
      const result = await startEnrollment(payload, student, parsed.data.timezone)
      if (!result.ok) return { status: 'error', error: result.error }
      return { status: 'success' }
    } catch (error) {
      console.error('[enrollments] starting a program failed', error)
      await captureServerError(error, 'enrollments-start')
      return { status: 'error', error: 'server' }
    }
  })
}
