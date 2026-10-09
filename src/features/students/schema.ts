import { z } from 'zod'

import { emailSchema } from '@/features/auth/schema'

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
