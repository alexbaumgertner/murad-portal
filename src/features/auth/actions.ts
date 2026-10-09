'use server'

import { hasLocale } from 'next-intl'
import { cookies, headers } from 'next/headers'

import { track } from '@/lib/analytics'
import { captureServerError, monitorAction } from '@/lib/monitoring/server'
import { localizedPath } from '@/i18n/alternates'
import { routing } from '@/i18n/routing'
import { getPayloadClient } from '@/lib/payload'
import type { User } from '@/payload-types'

import {
  ADDRESS_FORM_COOKIE,
  addressFormCookieOptions,
  parseAddressForm,
} from '@/i18n/address-form'

import type { CodeEmailStyle } from './code-email'
import { loginCodeSender } from './email'
import { requestCode, verifyCode, type OtpDeps } from './otp'
import { safeRedirect } from './redirect'
import type { LoginState } from './schema'
import {
  issueToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
  STUDENT_SESSION_TTL_SECONDS,
} from './session'
import { payloadOtpStore } from './store'

/**
 * How the code email speaks. Only called after the address belongs to a user, so it leaks nothing.
 * The owner keeps the English email; a student gets the language of the login page and her
 * «ты»/«вы» form (story 011c). A trusted server-side read: the visitor is not signed in yet.
 */
async function codeEmailStyle(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  email: string,
  formLocale: FormDataEntryValue | null,
): Promise<CodeEmailStyle | undefined> {
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const user = docs[0]
  if (user?.role !== 'student') return undefined
  const locale = hasLocale(routing.locales, formLocale) ? formLocale : (user.locale ?? 'ru')
  return { locale, addressForm: parseAddressForm(user.addressForm) }
}

async function otpDeps(formLocale: FormDataEntryValue | null = null): Promise<OtpDeps> {
  const payload = await getPayloadClient()
  const send = loginCodeSender(payload)
  return {
    store: payloadOtpStore(payload),
    sendCode: async (to, code) => {
      try {
        await send(to, code, await codeEmailStyle(payload, to, formLocale))
      } catch (error) {
        await captureServerError(error, 'auth-email')
        throw error
      }
    },
    secret: payload.secret,
  }
}

async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Where a fresh session goes. A student always lands on her study page, in the language of the
 * form she used (else her saved one), and never follows `redirect`: /admin is not hers.
 */
function destination(user: Pick<User, 'role' | 'locale'>, formData: FormData): string {
  if (user.role !== 'student') return safeRedirect(formData.get('redirect'))
  const formLocale = formData.get('locale')
  const locale = hasLocale(routing.locales, formLocale)
    ? formLocale
    : (user.locale ?? routing.defaultLocale)
  return localizedPath('/study', locale)
}

export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  return monitorAction('loginAction', () => handleLogin(prev, formData))
}

async function handleLogin(prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = formData.get('intent')

  if (intent === 'restart') return { step: 'email', email: prev.step === 'code' ? prev.email : '' }

  if (intent === 'request') {
    const email = String(formData.get('email') ?? '')
    const result = await requestCode(email, await clientIp(), await otpDeps(formData.get('locale')))
    if (!result.ok) {
      // Resending from the code step keeps the user on that step with the error.
      return prev.step === 'code'
        ? { ...prev, error: result.error }
        : { step: 'email', email, error: result.error }
    }
    await track('login_code_requested', { resend: prev.step === 'code' }, headers)
    return { step: 'code', email: result.email }
  }

  if (intent === 'verify' && prev.step === 'code') {
    const code = String(formData.get('code') ?? '')
    const deps = await otpDeps()
    const result = await verifyCode(prev.email, code, deps)
    if (!result.ok) return { ...prev, error: result.error }

    const payload = await getPayloadClient()
    const user = await payload.findByID({
      collection: 'users',
      id: result.userId,
      depth: 0,
      overrideAccess: true,
    })
    const ttl = user.role === 'student' ? STUDENT_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS
    const { token, maxAge } = issueToken(result.userId, deps.secret, Date.now(), ttl)
    ;(await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(maxAge))
    if (user.role === 'student') {
      // Lets the signed-out /login page speak to her in her form next time.
      ;(await cookies()).set(
        ADDRESS_FORM_COOKIE,
        parseAddressForm(user.addressForm),
        addressFormCookieOptions(),
      )
    }
    await track('login_succeeded', {}, headers)
    return { step: 'done', redirectTo: destination(user, formData) }
  }

  return prev
}

export async function logoutAction(): Promise<void> {
  return monitorAction('logoutAction', async () => {
    ;(await cookies()).set(SESSION_COOKIE, '', sessionCookieOptions(0))
  })
}
