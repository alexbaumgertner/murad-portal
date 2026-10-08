import { siteConfig } from '@/config/site'
import { defaultLocale } from '@/i18n/locales'

/**
 * The invite a student gets when the owner adds her (story 011). It holds only a link to the
 * public /login page — no code, no token — so a forwarded invite cannot sign anyone in.
 * Pure template (no env): `send-invite.ts` sends it.
 */

export type InviteLocale = 'ru' | 'en'

// «ты» only for now; the «вы» variant comes with the addressForm setting (011c).
const copy = {
  ru: {
    subject: 'Мурад пригласил тебя в трекер учёбы',
    lead: 'Мурад добавил тебя в трекер учёбы: там будет твой план занятий и отметки за каждый день.',
    how: 'Чтобы войти, открой ссылку и введи этот адрес почты — пришлём код. Пароль не нужен.',
    button: 'Войти в трекер',
    ignore: 'Если ты не ждёшь этого письма, просто не обращай на него внимания.',
  },
  en: {
    subject: 'Murad invited you to the study tracker',
    lead: 'Murad added you to his study tracker: your study plan and daily progress will live there.',
    how: 'To sign in, open the link and enter this email address — we will send you a code. No password needed.',
    button: 'Open the study tracker',
    ignore: 'If you were not expecting this email, you can ignore it.',
  },
} satisfies Record<InviteLocale, Record<string, string>>

export function loginUrl(locale: InviteLocale, siteUrl: string): string {
  const path = locale === defaultLocale ? '/login' : `/${locale}/login`
  return new URL(path, siteUrl).href
}

export function inviteEmail(locale: InviteLocale, siteUrl: string) {
  const t = copy[locale]
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
