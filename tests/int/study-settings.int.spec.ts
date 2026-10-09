import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { loginAction } from '@/features/auth/actions'
import type { LoginState } from '@/features/auth/schema'
import { issueToken, SESSION_COOKIE } from '@/features/auth/session'
import { saveStudySettingsAction } from '@/features/students/actions'
import { initialSettingsState } from '@/features/students/schema'
import { ADDRESS_FORM_COOKIE } from '@/i18n/address-form'

const request = vi.hoisted(() => ({
  headers: new Headers(),
  cookies: { set: vi.fn() },
}))
vi.mock('next/headers', () => ({
  headers: async () => request.headers,
  cookies: async () => request.cookies,
}))

const emails = {
  owner: 'settings-owner@example.com',
  anna: 'settings-anna@example.com',
  boris: 'settings-boris@example.com',
  vera: 'settings-vera@example.com',
}

let payload: Payload
let owner: TypedUser
let anna: TypedUser
let ipSeq = 0

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

const sessionHeaders = (user: { id: number | string }) =>
  new Headers({ cookie: `${SESSION_COOKIE}=${issueToken(user.id, payload.secret).token}` })

/** Without RESEND_API_KEY every email is printed by the dev sender; capture what was "sent". */
async function captureMail<T>(work: () => Promise<T>): Promise<{ result: T; mail: string }> {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  try {
    const result = await work()
    return { result, mail: info.mock.calls.flat().join('\n') }
  } finally {
    info.mockRestore()
  }
}

const asTyped = (doc: object) => ({ ...doc, collection: 'users' }) as unknown as TypedUser

async function addressFormOf(email: string) {
  const { docs } = await payload.find({ collection: 'users', where: { email: { equals: email } } })
  return docs[0]?.addressForm
}

async function codeMailFor(email: string, locale = 'ru') {
  return captureMail(async () => {
    const state: LoginState = { step: 'email' }
    return loginAction(state, form({ intent: 'request', email, locale }))
  })
}

async function cleanup() {
  await payload.delete({ collection: 'users', where: { email: { in: Object.values(emails) } } })
  await payload.delete({ collection: 'auth-codes', where: { id: { exists: true } } })
}

describe('«ты»/«вы» setting (story 011c)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await cleanup()
    owner = asTyped(
      await payload.create({ collection: 'users', data: { email: emails.owner, role: 'owner' } }),
    )
    await captureMail(async () => {
      anna = asTyped(
        await payload.create({
          collection: 'users',
          data: { email: emails.anna, role: 'student' },
        }),
      )
      await payload.create({
        collection: 'users',
        data: { email: emails.boris, role: 'student' },
      })
    })
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    request.headers = new Headers({ 'x-forwarded-for': `203.0.113.${++ipSeq}` })
    await payload.delete({ collection: 'auth-codes', where: { id: { exists: true } } })
    await payload.update({
      collection: 'users',
      where: { email: { in: [emails.anna, emails.boris] } },
      data: { addressForm: 'ty' },
    })
  })

  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  describe('8 — the student picks «вы» on /study/settings', () => {
    it('is «ты» until she chooses', async () => {
      expect(await addressFormOf(emails.anna)).toBe('ty')
    })

    it('saves her choice and remembers it in a cookie for /login', async () => {
      request.headers = sessionHeaders(anna)
      const result = await saveStudySettingsAction(
        initialSettingsState,
        form({ addressForm: 'vy' }),
      )

      expect(result).toEqual({ status: 'success', addressForm: 'vy' })
      expect(await addressFormOf(emails.anna)).toBe('vy')
      expect(request.cookies.set).toHaveBeenCalledWith(
        ADDRESS_FORM_COOKIE,
        'vy',
        expect.objectContaining({ path: '/', sameSite: 'lax' }),
      )
    })

    it('switches back to «ты»', async () => {
      request.headers = sessionHeaders(anna)
      await saveStudySettingsAction(initialSettingsState, form({ addressForm: 'vy' }))
      const result = await saveStudySettingsAction(
        initialSettingsState,
        form({ addressForm: 'ty' }),
      )
      expect(result).toEqual({ status: 'success', addressForm: 'ty' })
      expect(await addressFormOf(emails.anna)).toBe('ty')
    })

    it('rejects anything but ty and vy and changes nothing', async () => {
      request.headers = sessionHeaders(anna)
      for (const value of ['formal', '', 'VY ']) {
        expect(
          await saveStudySettingsAction(initialSettingsState, form({ addressForm: value })),
        ).toEqual({ status: 'error', error: 'invalid_form' })
      }
      expect(await addressFormOf(emails.anna)).toBe('ty')
      expect(request.cookies.set).not.toHaveBeenCalled()
    })

    it('changes only her own record, whatever else the form sends', async () => {
      request.headers = sessionHeaders(anna)
      await saveStudySettingsAction(
        initialSettingsState,
        form({ addressForm: 'vy', id: 'x', email: emails.boris, role: 'owner' }),
      )
      expect(await addressFormOf(emails.boris)).toBe('ty')
      const { docs } = await payload.find({
        collection: 'users',
        where: { email: { equals: emails.anna } },
      })
      expect(docs[0]).toMatchObject({ role: 'student', email: emails.anna })
    })

    it('refuses a signed-out visitor and the owner (she has no study settings)', async () => {
      for (const headers of [new Headers(), sessionHeaders(owner)]) {
        request.headers = headers
        expect(
          await saveStudySettingsAction(initialSettingsState, form({ addressForm: 'vy' })),
        ).toEqual({ status: 'error', error: 'unauthorized' })
      }
      expect(request.cookies.set).not.toHaveBeenCalled()
    })
  })

  describe('8 — emails use the form of the student', () => {
    it('sends the code in «ты» by default', async () => {
      const { mail } = await codeMailFor(emails.anna)
      expect(mail).toContain(emails.anna)
      expect(mail).toContain('проигнорируй ')
      expect(mail).not.toContain('проигнорируйте')
    })

    it('sends the code in «вы» after she switched', async () => {
      await payload.update({
        collection: 'users',
        where: { email: { equals: emails.anna } },
        data: { addressForm: 'vy' },
      })
      const { mail } = await codeMailFor(emails.anna)
      expect(mail).toContain('проигнорируйте')
    })

    it('keeps the English code email for an English login page, «вы» or not', async () => {
      await payload.update({
        collection: 'users',
        where: { email: { equals: emails.anna } },
        data: { addressForm: 'vy' },
      })
      const { mail } = await codeMailFor(emails.anna, 'en')
      expect(mail).toMatch(/\d{6}/)
      expect(mail).not.toMatch(/[а-яё]/i)
    })

    it('invites in «вы» when the owner presets it', async () => {
      const { mail } = await captureMail(() =>
        payload.create({
          collection: 'users',
          data: { email: emails.vera, role: 'student', addressForm: 'vy' },
        }),
      )
      expect(mail).toContain('Мурад пригласил вас в трекер учёбы')
      expect(await addressFormOf(emails.vera)).toBe('vy')
    })

    it('invites in «ты» when the owner presets nothing', async () => {
      await payload.delete({ collection: 'users', where: { email: { equals: emails.vera } } })
      const { mail } = await captureMail(() =>
        payload.create({ collection: 'users', data: { email: emails.vera, role: 'student' } }),
      )
      expect(mail).toContain('Мурад пригласил тебя в трекер учёбы')
    })

    it('signs in with the saved form in the cookie for the next visit to /login', async () => {
      await payload.update({
        collection: 'users',
        where: { email: { equals: emails.anna } },
        data: { addressForm: 'vy' },
      })
      const { state, code } = await (async () => {
        const { result, mail } = await codeMailFor(emails.anna)
        return { state: result, code: mail.match(/(\d{6})/)?.[1] }
      })()
      await loginAction(state, form({ intent: 'verify', code: code ?? '' }))
      expect(request.cookies.set).toHaveBeenCalledWith(
        ADDRESS_FORM_COOKIE,
        'vy',
        expect.objectContaining({ path: '/' }),
      )
    })
  })
})
