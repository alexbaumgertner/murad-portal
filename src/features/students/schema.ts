import { z } from 'zod'

import { emailSchema } from '@/features/auth/schema'
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
