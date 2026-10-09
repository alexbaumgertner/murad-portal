import { siteConfig } from '@/config/site'
import type { AddressForm } from '@/i18n/address-form'
import { defaultLocale } from '@/i18n/locales'

/**
 * The invite a student gets when the owner adds her (story 011). It holds only a link to the
 * public /login page — no code, no token — so a forwarded invite cannot sign anyone in.
 * Pure template (no env): `send-invite.ts` sends it.
 */

export type InviteLocale = 'ru' | 'en'

// Russian has two forms (D-SP-8); the owner can preset the student's form, «ты» if none.
const copy = {
  ru: {
    subject: 'Мурад пригласил тебя в трекер учёбы',
    lead: 'Мурад добавил тебя в трекер учёбы: там будет твой план занятий и отметки за каждый день.',
    how: 'Чтобы войти, открой ссылку и введи этот адрес почты — пришлём код. Пароль не нужен.',
    button: 'Войти в трекер',
    ignore: 'Если ты не ждёшь этого письма, просто не обращай на него внимания.',
  },
  ruVy: {
    subject: 'Мурад пригласил вас в трекер учёбы',
    lead: 'Мурад добавил вас в трекер учёбы: там будет ваш план занятий и отметки за каждый день.',
    how: 'Чтобы войти, откройте ссылку и введите этот адрес почты — пришлём код. Пароль не нужен.',
    button: 'Войти в трекер',
    ignore: 'Если вы не ждёте этого письма, просто не обращайте на него внимания.',
  },
  en: {
    subject: 'Murad invited you to the study tracker',
    lead: 'Murad added you to his study tracker: your study plan and daily progress will live there.',
    how: 'To sign in, open the link and enter this email address — we will send you a code. No password needed.',
    button: 'Open the study tracker',
    ignore: 'If you were not expecting this email, you can ignore it.',
  },
} satisfies Record<'ru' | 'ruVy' | InviteLocale, Record<string, string>>

export function loginUrl(locale: InviteLocale, siteUrl: string): string {
  const path = locale === defaultLocale ? '/login' : `/${locale}/login`
  return new URL(path, siteUrl).href
}

export function inviteEmail(
  locale: InviteLocale,
  siteUrl: string,
  addressForm: AddressForm = 'ty',
) {
  const t = locale === 'ru' && addressForm === 'vy' ? copy.ruVy : copy[locale]
  const url = loginUrl(locale, siteUrl)
  const text = [t.lead, '', t.how, url, '', t.ignore].join('\n')
  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#1b1a17;max-width:32rem">',
    `<p style="margin:0 0 1.25rem;font-weight:600">${siteConfig.name}</p>`,
    `<p style="margin:0 0 .75rem">${t.lead}</p>`,
    `<p style="margin:0 0 1.25rem">${t.how}</p>`,
    `<p style="margin:0 0 1.25rem"><a href="${url}" style="display:inline-block;padding:.6rem 1.1rem;border-radius:8px;background:#1b1a17;color:#fff;text-decoration:none;font-weight:600">${t.button}</a></p>`,
    `<p style="margin:1.75rem 0 0;font-size:13px;color:#6b675e">${t.ignore}</p>`,
    '</div>',
  ].join('')
  return { subject: t.subject, text, html }
}
