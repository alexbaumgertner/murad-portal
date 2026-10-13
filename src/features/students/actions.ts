'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { z } from 'zod'

import { currentAdmin, currentStudent } from '@/features/auth/current-user'
import { ADDRESS_FORM_COOKIE, addressFormCookieOptions } from '@/i18n/address-form'
import { captureServerError, monitorAction } from '@/lib/monitoring/server'
import { getPayloadClient } from '@/lib/payload'

import {
  avatarFileSchema,
  inviteSchema,
  settingsSchema,
  type AvatarError,
  type AvatarState,
  type InviteState,
  type SettingsState,
} from './schema'
import { inviteStudent, removeAvatar, saveAvatar, updateAddressForm } from './service'

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

export async function saveStudySettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  return monitorAction('saveStudySettingsAction', async () => {
    const payload = await getPayloadClient()
    const student = await currentStudent(payload, await headers())
    if (!student) return { status: 'error', error: 'unauthorized' }

    // Only `addressForm` is read: the record to change is always the signed-in student's own.
    const parsed = settingsSchema.safeParse({
      addressForm: String(formData.get('addressForm') ?? ''),
    })
    if (!parsed.success) return { status: 'error', error: 'invalid_form' }

    try {
      await updateAddressForm(payload, student, parsed.data.addressForm)
    } catch (error) {
      console.error('[students] saving settings failed', error)
      await captureServerError(error, 'students-settings')
      return { status: 'error', error: 'server' }
    }
    ;(await cookies()).set(ADDRESS_FORM_COOKIE, parsed.data.addressForm, addressFormCookieOptions())
    return { status: 'success', addressForm: parsed.data.addressForm }
  })
}

export async function saveAvatarAction(
  _prev: AvatarState,
  formData: FormData,
): Promise<AvatarState> {
  return monitorAction('saveAvatarAction', async () => {
    const payload = await getPayloadClient()
    const student = await currentStudent(payload, await headers())
    if (!student) return { status: 'error', error: 'unauthorized' }

    // Only the file is read: the owner of the avatar is always the signed-in student.
    const parsed = avatarFileSchema.safeParse(formData.get('avatar'))
    if (!parsed.success) {
      const picked = formData.get('avatar')
      if (!(picked instanceof File) || picked.name === '') {
        return { status: 'error', error: 'no_file' }
      }
      return { status: 'error', error: parsed.error.issues[0]?.message as AvatarError }
    }
    const file = parsed.data

    try {
      const result = await saveAvatar(payload, student, {
        data: Buffer.from(await file.arrayBuffer()),
        name: file.name,
        type: file.type,
        size: file.size,
      })
      if (!result.ok) return { status: 'error', error: result.error }
    } catch (error) {
      console.error('[students] saving avatar failed', error)
      await captureServerError(error, 'students-avatar')
      return { status: 'error', error: 'server' }
    }
    revalidatePath('/study')
    return { status: 'success', removed: false }
  })
}

export async function removeAvatarAction(): Promise<AvatarState> {
  return monitorAction('removeAvatarAction', async () => {
    const payload = await getPayloadClient()
    const student = await currentStudent(payload, await headers())
    if (!student) return { status: 'error', error: 'unauthorized' }

    try {
      await removeAvatar(payload, student)
    } catch (error) {
      console.error('[students] removing avatar failed', error)
      await captureServerError(error, 'students-avatar')
      return { status: 'error', error: 'server' }
    }
    revalidatePath('/study')
    return { status: 'success', removed: true }
  })
}
