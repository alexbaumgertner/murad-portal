import { siteConfig } from '@/config/site'
import type { AddressForm } from '@/i18n/address-form'
import { defaultLocale } from '@/i18n/locales'

/**
 * The email a student gets when the owner assigns her a program (story 012). It names the levels
 * and links to /study; the placement result and the owner's note are never in it.
 * Pure template (no env): `send-assigned.ts` sends it.
 */

export type MailLocale = 'ru' | 'en'

const copy = {
  ru: {
    subject: (levels: string) => `Мурад назначил тебе программу ${levels}`,
    lead: 'Открой страницу учёбы, посмотри программу и нажми «Начать» в удобный день.',
    button: 'Открыть программу',
  },
  ruVy: {
    subject: (levels: string) => `Мурад назначил вам программу ${levels}`,
    lead: 'Откройте страницу учёбы, посмотрите программу и нажмите «Начать» в удобный день.',
    button: 'Открыть программу',
  },
  en: {
    subject: (levels: string) => `Murad assigned you the program ${levels}`,
    lead: 'Open your study page, look through the program and press «Start» on a day that suits you.',
    button: 'Open the program',
  },
} satisfies Record<'ru' | 'ruVy' | MailLocale, Record<string, unknown>>

export function studyUrl(locale: MailLocale, siteUrl: string): string {
  const path = locale === defaultLocale ? '/study' : `/${locale}/study`
  return new URL(path, siteUrl).href
}

export function assignedEmail(
  locale: MailLocale,
  siteUrl: string,
  levels: { from: string; to: string },
  addressForm: AddressForm = 'ty',
) {
  const t = locale === 'ru' && addressForm === 'vy' ? copy.ruVy : copy[locale]
  const subject = t.subject(`${levels.from} → ${levels.to}`)
  const url = studyUrl(locale, siteUrl)
  const text = [subject, '', t.lead, url].join('\n')
  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#1b1a17;max-width:32rem">',
    `<p style="margin:0 0 1.25rem;font-weight:600">${siteConfig.name}</p>`,
    `<p style="margin:0 0 .75rem">${subject}</p>`,
    `<p style="margin:0 0 1.25rem">${t.lead}</p>`,
    `<p style="margin:0"><a href="${url}" style="display:inline-block;padding:.6rem 1.1rem;border-radius:8px;background:#1b1a17;color:#fff;text-decoration:none;font-weight:600">${t.button}</a></p>`,
    '</div>',
  ].join('')
  return { subject, text, html }
}
