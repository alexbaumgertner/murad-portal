'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'

import { currentAdmin } from '@/features/auth/current-user'
import { locales } from '@/i18n/locales'
import { track } from '@/lib/analytics'
import { captureServerError, monitorAction } from '@/lib/monitoring/server'
import { getPayloadClient } from '@/lib/payload'

import {
  closeDaySchema,
  videoRetroSchema,
  retroFields,
  type VideoRetroState,
  type CloseDayState,
} from './schema'
import { closeDay, saveVideoRetro } from './service'

export async function closeDayAction(
  prev: CloseDayState,
  formData: FormData,
): Promise<CloseDayState> {
  return monitorAction('closeDayAction', () => handleCloseDay(prev, formData))
}

async function handleCloseDay(_prev: CloseDayState, formData: FormData): Promise<CloseDayState> {
  try {
    const payload = await getPayloadClient()

    // The session is checked on the server before anything else, so the answer for a forged
    // call never depends on the input. Only the form fields below come from the client.
    const user = await currentAdmin(payload, await headers())
    if (!user) return { status: 'error', error: 'unauthorized' }

    const parsed = closeDaySchema.safeParse({
      slug: formData.get('slug') ?? '',
      dayNumber: formData.get('dayNumber') ?? '',
      minutes: formData.get('minutes') ?? '',
      notes: formData.get('notes') ?? undefined,
    })
    if (!parsed.success) {
      const { fieldErrors } = z.flattenError(parsed.error)
      return {
        status: 'error',
        error: fieldErrors.minutes
          ? 'invalid_minutes'
          : fieldErrors.notes
            ? 'invalid_notes'
            : fieldErrors.dayNumber
              ? 'invalid_day'
              : 'invalid_request',
      }
    }

    const result = await closeDay(payload, user, parsed.data)
    if (!result.ok) return { status: 'error', error: result.error }

    for (const locale of locales) revalidatePath(`/${locale}/challenge/${parsed.data.slug}`)
    await track('challenge_day_closed', { updated: result.updated }, headers)
    return { status: 'success', dayNumber: parsed.data.dayNumber, updated: result.updated }
  } catch (error) {
    console.error('[challenge] failed to close a day', error)
    await captureServerError(error, 'challenge')
    return { status: 'error', error: 'server' }
  }
}

export async function saveVideoRetroAction(
  prev: VideoRetroState,
  formData: FormData,
): Promise<VideoRetroState> {
  return monitorAction('saveVideoRetroAction', () => handleVideoRetro(prev, formData))
}

async function handleVideoRetro(
  _prev: VideoRetroState,
  formData: FormData,
): Promise<VideoRetroState> {
  try {
    const payload = await getPayloadClient()
    const user = await currentAdmin(payload, await headers())
    if (!user) return { status: 'error', error: 'unauthorized' }
    const parsed = videoRetroSchema.safeParse(
      Object.fromEntries(
        ['slug', 'blockNumber', 'youtubeUrl', 'publishedAt', ...retroFields].map((key) => [
          key,
          formData.get(key) ?? '',
        ]),
      ),
    )
    if (!parsed.success) {
      const { fieldErrors } = z.flattenError(parsed.error)
      return {
        status: 'error',
        error: fieldErrors.youtubeUrl
          ? 'invalid_url'
          : fieldErrors.publishedAt
            ? 'invalid_date'
            : retroFields.some((key) => fieldErrors[key])
              ? 'invalid_retro'
              : 'invalid_request',
      }
    }
    const result = await saveVideoRetro(payload, user, parsed.data)
    if (!result.ok) return { status: 'error', error: result.error }
    for (const locale of locales) revalidatePath(`/${locale}/challenge/${parsed.data.slug}`)
    return { status: 'success' }
  } catch (error) {
    console.error('[challenge] failed to save video retro', error)
    await captureServerError(error, 'challenge')
    return { status: 'error', error: 'server' }
  }
}
