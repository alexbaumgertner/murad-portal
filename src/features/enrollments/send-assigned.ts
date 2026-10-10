import type { Payload } from 'payload'

import type { AddressForm } from '@/i18n/address-form'
import { env } from '@/lib/env'

import { assignedEmail, type MailLocale } from './assigned-email'

// Framework-free: the enrollments collection hook calls it, and the Payload CLI loads collections.

/** Like the invite: without RESEND_API_KEY outside production the email is printed instead. */
export async function sendAssigned(
  payload: Payload,
  to: string,
  levels: { from: string; to: string },
  locale: MailLocale = 'ru',
  addressForm: AddressForm = 'ty',
): Promise<void> {
  const mail = assignedEmail(locale, env.NEXT_PUBLIC_SITE_URL, levels, addressForm)
  if (!env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === 'production') throw new Error('RESEND_API_KEY is not set')
    console.info(
      `\n[enrollments] RESEND_API_KEY not set — email for ${to}: ${mail.subject}\n${mail.text}\n`,
    )
    return
  }
  await payload.sendEmail({ to, ...mail })
}
