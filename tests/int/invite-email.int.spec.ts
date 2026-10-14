import type { Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The invite email is checked through a fake `payload.sendEmail`: no Resend key, no network.

vi.mock('@/lib/env', () => ({
  env: { RESEND_API_KEY: 'test-key', NEXT_PUBLIC_SITE_URL: 'https://example.test' },
}))

import { InviteEmailError, sendInvite } from '@/features/students/send-invite'

const sendEmail = vi.fn()
const fakePayload = { sendEmail } as unknown as Payload

beforeEach(() => {
  sendEmail.mockReset()
})

describe('sendInvite', () => {
  it('sends one email to the student with a plain /login link', async () => {
    await sendInvite(fakePayload, 'anna@example.com')

    expect(sendEmail).toHaveBeenCalledTimes(1)
    const mail = sendEmail.mock.calls[0]![0] as {
      to: string
      subject: string
      text: string
      html: string
    }
    expect(mail.to).toBe('anna@example.com')
    expect(mail.subject).toBe('Мурад пригласил тебя в трекер учёбы')
    expect(mail.text).toContain('https://example.test/login')
    expect(mail.html).toContain('href="https://example.test/login"')
  })

  it('uses «вы» when the owner preset it', async () => {
    await sendInvite(fakePayload, 'anna@example.com', 'ru', 'vy')

    expect(sendEmail.mock.calls[0]![0]).toMatchObject({
      subject: 'Мурад пригласил вас в трекер учёбы',
    })
  })

  it('links to the localized login page in English', async () => {
    await sendInvite(fakePayload, 'anna@example.com', 'en')

    const mail = sendEmail.mock.calls[0]![0] as { subject: string; text: string }
    expect(mail.subject).toBe('Murad invited you to the study tracker')
    expect(mail.text).toContain('https://example.test/en/login')
  })

  it('carries no code or token, only the login link', async () => {
    await sendInvite(fakePayload, 'anna@example.com')

    const { text } = sendEmail.mock.calls[0]![0] as { text: string }
    expect(text).not.toMatch(/\b\d{6}\b/)
    expect(text).not.toMatch(/[?&](token|code)=/)
  })

  it('wraps a transport failure in InviteEmailError', async () => {
    sendEmail.mockRejectedValueOnce(new Error('422 validation_error'))

    await expect(sendInvite(fakePayload, 'anna@example.com')).rejects.toBeInstanceOf(
      InviteEmailError,
    )
  })
})
