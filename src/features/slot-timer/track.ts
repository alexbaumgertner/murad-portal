import 'server-only'

import { headers } from 'next/headers'

import { track } from '@/lib/analytics'

import { minutesBucket } from './shape'
import type { CompletedSlot } from './service'

/** `slot_completed` once per slot that just reached its minimum (never ids of people, never exact minutes). */
export async function trackCompleted(completed: CompletedSlot[], viaTimer: boolean): Promise<void> {
  for (const slot of completed) {
    await track(
      'slot_completed',
      { slotTypeId: slot.slotTypeId, minutesBucket: minutesBucket(slot.minutes), viaTimer },
      async () => headers(),
    )
  }
}
