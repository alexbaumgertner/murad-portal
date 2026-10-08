import { describe, expect, it } from 'vitest'

import { inviteEmail } from '@/features/students/invite-email'

const SITE = 'https://murad.example'

describe('invite email (story 011, criterion 1)', () => {
  it('invites in Russian («ты») with a link to /login', () => {
    const mail = inviteEmail('ru', SITE)
    expect(mail.subject).toBe('Мурад пригласил тебя в трекер учёбы')
    expect(mail.text).toContain(`${SITE}/login`)
    expect(mail.html).toContain(`href="${SITE}/login"`)
  })

  it('links to the English login page for an English-speaking student', () => {
    const mail = inviteEmail('en', SITE)
    expect(mail.subject).toBe('Murad invited you to the study tracker')
    expect(mail.text).toContain(`${SITE}/en/login`)
  })

  it('carries no code or token: the link alone cannot sign anyone in', () => {
    for (const locale of ['ru', 'en'] as const) {
      const { text, html } = inviteEmail(locale, SITE)
      expect(text).not.toMatch(/\d{6}/)
      expect(html).not.toMatch(/[?&](token|code)=/)
    }
  })
})
