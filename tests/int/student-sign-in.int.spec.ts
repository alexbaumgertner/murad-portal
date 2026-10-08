import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { loginAction } from '@/features/auth/actions'
import type { LoginState } from '@/features/auth/schema'
import {
  issueToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  STUDENT_SESSION_TTL_SECONDS,
} from '@/features/auth/session'
import { inviteStudentAction } from '@/features/students/actions'
import { initialInviteState } from '@/features/students/schema'

const request = vi.hoisted(() => ({
  headers: new Headers(),
  cookies: { set: vi.fn() },
}))
vi.mock('next/headers', () => ({
  headers: async () => request.headers,
  cookies: async () => request.cookies,
}))

const emails = {
  owner: 'signin-owner@example.com',
  anna: 'signin-anna@example.com',
  invited: 'signin-invited@example.com',
  sneaky: 'signin-sneaky@example.com',
  stranger: 'signin-stranger@example.com',
}

let payload: Payload
let owner: TypedUser
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

async function requestCode(email: string, prev: LoginState = { step: 'email' }, locale = 'ru') {
  const { result: state, mail } = await captureMail(() =>
    loginAction(prev, form({ intent: 'request', email, locale })),
  )
  return { state, mail, code: mail.match(/: (\d{6})/)?.[1] }
}

async function cleanup() {
  await payload.delete({ collection: 'users', where: { email: { in: Object.values(emails) } } })
  await payload.delete({ collection: 'auth-codes', where: { id: { exists: true } } })
}

describe('student invite and sign-in (story 011b)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await cleanup()
    owner = {
      ...(await payload.create({
        collection: 'users',
        data: { email: emails.owner, role: 'owner' },
      })),
      collection: 'users',
    } as unknown as TypedUser
    await captureMail(() =>
      payload.create({ collection: 'users', data: { email: emails.anna, role: 'student' } }),
    )
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    // A fresh client IP per test keeps the per-IP limit out of the way.
    request.headers = new Headers({ 'x-forwarded-for': `198.51.100.${++ipSeq}` })
    await payload.delete({ collection: 'auth-codes', where: { id: { exists: true } } })
  })

  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  describe('1 — the owner invites a student', () => {
    it('creates a student and emails an invite with a link to /login', async () => {
      request.headers = sessionHeaders(owner)
      const { result, mail } = await captureMail(() =>
        inviteStudentAction(initialInviteState, form({ email: ' Signin-Invited@Example.com ' })),
      )

      expect(result).toEqual({ status: 'success', email: emails.invited })
      const { docs } = await payload.find({
        collection: 'users',
        where: { email: { equals: emails.invited } },
      })
      expect(docs[0]).toMatchObject({ role: 'student', locale: 'ru', addressForm: 'ty' })
      expect(docs[0]?.invitedAt).toEqual(expect.any(String))
      expect(mail).toContain(emails.invited)
      expect(mail).toContain('Мурад пригласил тебя в трекер учёбы')
      expect(mail).toMatch(/https?:\/\/\S+\/login/)
    })

    it('always creates a student, whatever role the form sends', async () => {
      request.headers = sessionHeaders(owner)
      await captureMail(() =>
        inviteStudentAction(initialInviteState, form({ email: emails.sneaky, role: 'owner' })),
      )

      const { docs } = await payload.find({
        collection: 'users',
        where: { email: { equals: emails.sneaky } },
      })
      expect(docs[0]?.role).toBe('student')
    })

    it('does not invite an address that already has an account, and sends nothing', async () => {
      request.headers = sessionHeaders(owner)
      const { result, mail } = await captureMail(() =>
        inviteStudentAction(initialInviteState, form({ email: emails.anna })),
      )
      expect(result).toEqual({ status: 'error', error: 'already_invited' })
      expect(mail).toBe('')
    })

    it('refuses a student or a signed-out visitor', async () => {
      const anna = (
        await payload.find({ collection: 'users', where: { email: { equals: emails.anna } } })
      ).docs[0]!
      for (const headers of [sessionHeaders(anna), new Headers()]) {
        request.headers = headers
        const { result, mail } = await captureMail(() =>
          inviteStudentAction(initialInviteState, form({ email: emails.stranger })),
        )
        expect(result).toEqual({ status: 'error', error: 'forbidden' })
        expect(mail).toBe('')
      }
      const { totalDocs } = await payload.count({
        collection: 'users',
        where: { email: { equals: emails.stranger } },
      })
      expect(totalDocs).toBe(0)
    })

    it('leaves no account behind when the invite email cannot be sent', async () => {
      request.headers = sessionHeaders(owner)
      // In production without RESEND_API_KEY the sender refuses to "send".
      vi.stubEnv('NODE_ENV', 'production')
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        expect(
          await inviteStudentAction(initialInviteState, form({ email: emails.stranger })),
        ).toEqual({ status: 'error', error: 'mail_failed' })
      } finally {
        vi.unstubAllEnvs()
        error.mockRestore()
      }
      const { totalDocs } = await payload.count({
        collection: 'users',
        where: { email: { equals: emails.stranger } },
      })
      expect(totalDocs).toBe(0)
    })

    it('rejects a malformed address', async () => {
      request.headers = sessionHeaders(owner)
      expect(await inviteStudentAction(initialInviteState, form({ email: 'nope' }))).toEqual({
        status: 'error',
        error: 'invalid_email',
      })
    })
  })

  describe('2 — an invited student signs in', () => {
    it('lands on /study with a 30-day session', async () => {
      const { state, code } = await requestCode(emails.anna)
      expect(state).toEqual({ step: 'code', email: emails.anna })

      const done = await loginAction(state, form({ intent: 'verify', code: code ?? '' }))

      expect(done).toEqual({ step: 'done', redirectTo: '/study' })
      expect(request.cookies.set).toHaveBeenCalledWith(
        SESSION_COOKIE,
        expect.any(String),
        expect.objectContaining({ maxAge: STUDENT_SESSION_TTL_SECONDS, httpOnly: true }),
      )
    })

    it('keeps the language of the login page', async () => {
      const { state, code } = await requestCode(emails.anna, { step: 'email' }, 'en')
      const done = await loginAction(
        state,
        form({ intent: 'verify', code: code ?? '', locale: 'en' }),
      )
      expect(done).toEqual({ step: 'done', redirectTo: '/en/study' })
    })

    it('ignores a redirect target for a student', async () => {
      const { state, code } = await requestCode(emails.anna)
      const done = await loginAction(
        state,
        form({ intent: 'verify', code: code ?? '', redirect: '/admin/collections/users' }),
      )
      expect(done).toEqual({ step: 'done', redirectTo: '/study' })
    })

    it('still sends the owner to the admin with a 7-day session', async () => {
      const { state, code } = await requestCode(emails.owner)
      const done = await loginAction(state, form({ intent: 'verify', code: code ?? '' }))
      expect(done).toEqual({ step: 'done', redirectTo: '/admin' })
      expect(request.cookies.set).toHaveBeenCalledWith(
        SESSION_COOKIE,
        expect.any(String),
        expect.objectContaining({ maxAge: SESSION_TTL_SECONDS }),
      )
    })
  })

  describe('3 — an address that was not invited', () => {
    it('gets the same answer as an invited one, and no email', async () => {
      const invited = await requestCode(emails.anna)
      const stranger = await requestCode(emails.stranger)

      expect(stranger.state).toEqual({ step: 'code', email: emails.stranger })
      expect(Object.keys(stranger.state)).toEqual(Object.keys(invited.state))
      expect(invited.mail).toContain(emails.anna)
      expect(stranger.mail).toBe('')
    })
  })

  describe('4 — a stale code', () => {
    it('is reported as expired after 5 wrong attempts and stops working', async () => {
      const { state, code } = await requestCode(emails.anna)
      let current: LoginState = state
      for (let i = 0; i < 4; i += 1) {
        current = await loginAction(current, form({ intent: 'verify', code: '000000' }))
        expect(current).toMatchObject({ step: 'code', error: 'wrong_code' })
      }
      current = await loginAction(current, form({ intent: 'verify', code: '000000' }))
      expect(current).toMatchObject({ step: 'code', error: 'code_expired' })

      const late = await loginAction(current, form({ intent: 'verify', code: code ?? '' }))
      expect(late).toMatchObject({ step: 'code', error: 'code_expired' })
      expect(request.cookies.set).not.toHaveBeenCalled()
    })
  })

  describe('5 — too many codes', () => {
    it('refuses a 4th code within 15 minutes', async () => {
      let state: LoginState = { step: 'email' }
      for (let i = 0; i < 3; i += 1) {
        ;({ state } = await requestCode(emails.anna, state))
        expect(state).toMatchObject({ step: 'code' })
        expect(state).not.toHaveProperty('error')
      }
      const fourth = await requestCode(emails.anna, state)
      expect(fourth.state).toEqual({ step: 'code', email: emails.anna, error: 'rate_limited' })
      expect(fourth.mail).toBe('')
    })
  })
})
