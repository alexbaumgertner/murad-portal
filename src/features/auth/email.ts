import type { Payload } from 'payload'

import { env } from '@/lib/env'

import { loginCodeEmail, type CodeEmailStyle } from './code-email'

/**
 * Sends through Payload's email adapter (Resend). Without RESEND_API_KEY outside
 * production the code is printed to the server console so local login still works.
 */
export function loginCodeSender(payload: Payload) {
  return async (to: string, code: string, style?: CodeEmailStyle) => {
    const mail = loginCodeEmail(code, style)
    if (!env.RESEND_API_KEY) {
      if (process.env.NODE_ENV === 'production') throw new Error('RESEND_API_KEY is not set')
      console.info(
        `\n[auth] RESEND_API_KEY not set — login code for ${to}: ${code}\n${mail.text}\n`,
      )
      return
    }
    await payload.sendEmail({ to, ...mail })
  }
}
