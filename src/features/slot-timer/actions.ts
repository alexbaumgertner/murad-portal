'use server'

import { headers } from 'next/headers'

import { currentStudent } from '@/features/auth/current-user'
import { captureServerError, monitorAction } from '@/lib/monitoring/server'
import { getPayloadClient } from '@/lib/payload'

import { emptySchema, startSchema, type TimerActionState } from './schema'
import { getTimerState, startTimer, stopTimer, type TimerResult } from './service'
import { trackCompleted } from './track'

async function run(
  name: string,
  work: (
    payload: Awaited<ReturnType<typeof getPayloadClient>>,
    student: NonNullable<Awaited<ReturnType<typeof currentStudent>>>,
  ) => Promise<TimerResult>,
): Promise<TimerActionState> {
  return monitorAction(name, async () => {
    const payload = await getPayloadClient()
    const student = await currentStudent(payload, await headers())
    if (!student) return { status: 'error', error: 'unauthorized' }
    try {
      const result = await work(payload, student)
      if (!result.ok) return { status: 'error', error: result.error }
      await trackCompleted(result.completedNow, true) // only after the state is saved
      return { status: 'success', state: result.state }
    } catch (error) {
      console.error(`[slot-timer] ${name} failed`, error)
      await captureServerError(error, 'slot-timer')
      return { status: 'error', error: 'server' }
    }
  })
}

/** «Старт» on one of today's slots; stops a timer running on another slot first. */
export async function startTimerAction(input: unknown): Promise<TimerActionState> {
  const parsed = startSchema.safeParse(input)
  if (!parsed.success) return { status: 'error', error: 'invalid_input' }
  return run('startTimerAction', (payload, student) =>
    startTimer(payload, student, parsed.data.slotIndex),
  )
}

/** «Стоп»: adds the whole minutes of the running timer. */
export async function stopTimerAction(input: unknown = {}): Promise<TimerActionState> {
  if (!emptySchema.safeParse(input).success) return { status: 'error', error: 'invalid_input' }
  return run('stopTimerAction', (payload, student) => stopTimer(payload, student))
}

/** The browser's counter passed the minimum: the server checks its own clock and saves «done». */
export async function syncTimerAction(input: unknown = {}): Promise<TimerActionState> {
  if (!emptySchema.safeParse(input).success) return { status: 'error', error: 'invalid_input' }
  return run('syncTimerAction', (payload, student) => getTimerState(payload, student))
}
