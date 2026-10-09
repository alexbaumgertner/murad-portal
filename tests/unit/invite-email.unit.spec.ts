import { describe, expect, it } from 'vitest'

import { loginCodeEmail } from '@/features/auth/code-email'
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

describe('«вы» in emails (story 011, criterion 8)', () => {
  it('invites in the «ты» form by default and when asked', () => {
    expect(inviteEmail('ru', SITE, 'ty')).toEqual(inviteEmail('ru', SITE))
  })

  it('invites in the «вы» form', () => {
    const mail = inviteEmail('ru', SITE, 'vy')
    expect(mail.subject).toBe('Мурад пригласил вас в трекер учёбы')
    expect(mail.text).toContain('откройте ссылку')
    expect(mail.text).not.toMatch(/(?<![\p{L}])(тебя|тебе|твой|открой)(?![\p{L}])/u)
    expect(mail.text).toContain(`${SITE}/login`)
  })

  it('does not change the English invite', () => {
    expect(inviteEmail('en', SITE, 'vy')).toEqual(inviteEmail('en', SITE, 'ty'))
  })
})

describe('login code email', () => {
  it('stays in English without a recipient style (the owner)', () => {
    expect(loginCodeEmail('123456').subject).toBe('123456 is your Murad login code')
  })

  it('speaks Russian to a student, «ты» or «вы»', () => {
    const ty = loginCodeEmail('123456', { locale: 'ru', addressForm: 'ty' })
    const vy = loginCodeEmail('123456', { locale: 'ru', addressForm: 'vy' })
    expect(ty.text).toContain('123456')
    expect(vy.text).toContain('123456')
    expect(ty.text).toContain('проигнорируй')
    expect(vy.text).toContain('проигнорируйте')
    expect(vy.text).not.toMatch(/(?<![\p{L}])(ты|тебя|твой|проигнорируй)(?![\p{L}])/u)
  })

  it('does not change the English text for «вы»', () => {
    expect(loginCodeEmail('123456', { locale: 'en', addressForm: 'vy' })).toEqual(
      loginCodeEmail('123456'),
    )
  })
})
