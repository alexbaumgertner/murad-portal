import { z } from 'zod'

import { emailSchema } from '@/features/auth/schema'
import { avatarError } from './shape'
import { addressForms, type AddressForm } from '@/i18n/address-form'

export const inviteSchema = z.object({
  email: emailSchema,
  name: z
    .string()
    .trim()
    .max(80)
    .transform((value) => value || undefined),
})

export type InviteInput = z.infer<typeof inviteSchema>

export type InviteError =
  'invalid_email' | 'invalid_name' | 'already_invited' | 'forbidden' | 'mail_failed'

export type InviteState =
  | { status: 'idle' }
  | { status: 'success'; email: string }
  | { status: 'error'; error: InviteError }

export const initialInviteState: InviteState = { status: 'idle' }

/** `/study/settings`: the student's own preferences. Only `addressForm` for now (story 011c). */
export const settingsSchema = z.object({ addressForm: z.enum(addressForms) })

export type SettingsError = 'unauthorized' | 'invalid_form' | 'server'

export type SettingsState =
  | { status: 'idle' }
  | { status: 'success'; addressForm: AddressForm }
  | { status: 'error'; error: SettingsError }

export const initialSettingsState: SettingsState = { status: 'idle' }

/** `/study/settings`: the profile picture (story 021). Errors are codes; the component translates them. */
export type AvatarError =
  'unauthorized' | 'no_file' | 'empty' | 'invalid_type' | 'too_large' | 'server'

export type AvatarState =
  | { status: 'idle' }
  | { status: 'success'; removed: boolean }
  | { status: 'error'; error: AvatarError }

export const initialAvatarState: AvatarState = { status: 'idle' }

/** The picked file: the message of a failed check is the error code. */
export const avatarFileSchema = z.instanceof(File).superRefine((file, ctx) => {
  const error = avatarError(file)
  if (error) ctx.addIssue({ code: 'custom', message: error })
})
