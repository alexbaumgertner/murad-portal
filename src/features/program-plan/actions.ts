'use server'

import { headers } from 'next/headers'

import { currentAdmin } from '@/features/auth/current-user'
import { captureServerError, monitorAction } from '@/lib/monitoring/server'
import { getPayloadClient } from '@/lib/payload'

import { copyWeekSchema, type CopyWeekState } from './schema'
import { copyWeek } from './service'

export async function copyWeekAction(
  _prev: CopyWeekState,
  formData: FormData,
): Promise<CopyWeekState> {
  return monitorAction('copyWeekAction', async () => {
    const payload = await getPayloadClient()
    const owner = await currentAdmin(payload, await headers())
    if (!owner) return { status: 'error', error: 'forbidden' }

    const parsed = copyWeekSchema.safeParse({
      programId: formData.get('programId'),
      fromWeek: formData.get('fromWeek'),
      toFirst: formData.get('toFirst'),
      toLast: formData.get('toLast'),
    })
    if (!parsed.success) return { status: 'error', error: 'invalid_input' }

    try {
      const result = await copyWeek(payload, owner, parsed.data)
      if (!result.ok) return { status: 'error', error: result.error }
      return { status: 'success', copied: result.copied, skipped: result.skipped }
    } catch (error) {
      console.error('[program-plan] copying a week failed', error)
      await captureServerError(error, 'program-plan-copy')
      return { status: 'error', error: 'server' }
    }
  })
}
