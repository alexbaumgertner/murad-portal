'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import { currentAdmin } from '@/features/auth/current-user'
import { monitorAction } from '@/lib/monitoring/server'
import { getPayloadClient } from '@/lib/payload'

import { inviteSchema, type InviteState } from './schema'
import { inviteStudent } from './service'

export async function inviteStudentAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  return monitorAction('inviteStudentAction', async () => {
    const payload = await getPayloadClient()
    const owner = await currentAdmin(payload, await headers())
    if (!owner) return { status: 'error', error: 'forbidden' }

    // Only email and name are read: the role is not an input of this flow.
    const parsed = inviteSchema.safeParse({
      email: String(formData.get('email') ?? ''),
      name: String(formData.get('name') ?? ''),
    })
    if (!parsed.success) {
      const fields = z.flattenError(parsed.error).fieldErrors
      return { status: 'error', error: fields.email ? 'invalid_email' : 'invalid_name' }
    }

    const result = await inviteStudent(payload, parsed.data, owner)
    if (!result.ok) return { status: 'error', error: result.error }
    return { status: 'success', email: result.email }
  })
}
