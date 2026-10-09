import type { Payload } from 'payload'

import type { AddressForm } from '@/i18n/address-form'
import { defaultLocale } from '@/i18n/locales'
import { env } from '@/lib/env'

import { inviteEmail, type InviteLocale } from './invite-email'

// Framework-free: the users collection hook calls it, and the Payload CLI loads collections.

/** Thrown from the users hook so the invite flow can tell a mail failure from other errors. */
export class InviteEmailError extends Error {
  constructor(cause: unknown) {
    super('Could not send the invite email', { cause })
    this.name = 'InviteEmailError'
  }
}

/** Like the login code: without RESEND_API_KEY outside production the email is printed instead. */
export async function sendInvite(
  payload: Payload,
  to: string,
  locale: InviteLocale = defaultLocale,
  addressForm: AddressForm = 'ty',
): Promise<void> {
  const mail = inviteEmail(locale, env.NEXT_PUBLIC_SITE_URL, addressForm)
  try {
    if (!env.RESEND_API_KEY) {
      if (process.env.NODE_ENV === 'production') throw new Error('RESEND_API_KEY is not set')
      console.info(
        `\n[students] RESEND_API_KEY not set — invite for ${to}: ${mail.subject}\n${mail.text}\n`,
      )
      return
    }
    await payload.sendEmail({ to, ...mail })
  } catch (error) {
    throw new InviteEmailError(error)
  }
}
