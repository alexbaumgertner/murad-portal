import { siteConfig } from '@/config/site'
import type { AddressForm } from '@/i18n/address-form'

/**
 * The login code email. Pure template (no env) so it can be unit-tested; `email.ts` sends it.
 * The owner gets the English text (admin is English-only). A student gets her page language,
 * and in Russian the «ты» or «вы» form she chose (story 011c). English never depends on the form.
 */

export type CodeEmailStyle = { locale: 'ru' | 'en'; addressForm: AddressForm }

const copy = {
  en: {
    subject: (code: string) => `${code} is your ${siteConfig.name} login code`,
    intro: 'Your login code:',
    plain: (code: string) => `Your ${siteConfig.name} login code: ${code}`,
    valid: 'It is valid for 10 minutes and works once.',
    ignore: 'If you did not try to sign in, you can ignore this email.',
  },
  ruTy: {
    subject: (code: string) => `${code} — код для входа в трекер учёбы`,
    intro: 'Твой код для входа:',
    plain: (code: string) => `Твой код для входа в трекер учёбы: ${code}`,
    valid: 'Он действует 10 минут и работает один раз.',
    ignore: 'Если это был не ты, просто проигнорируй письмо.',
  },
  ruVy: {
    subject: (code: string) => `${code} — код для входа в трекер учёбы`,
    intro: 'Ваш код для входа:',
    plain: (code: string) => `Ваш код для входа в трекер учёбы: ${code}`,
    valid: 'Он действует 10 минут и работает один раз.',
    ignore: 'Если это были не вы, просто проигнорируйте письмо.',
  },
}

function pick(style?: CodeEmailStyle) {
  if (style?.locale !== 'ru') return copy.en
  return style.addressForm === 'vy' ? copy.ruVy : copy.ruTy
}

export function loginCodeEmail(code: string, style?: CodeEmailStyle) {
  const t = pick(style)
  const text = [t.plain(code), '', t.valid, t.ignore].join('\n')
  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#1b1a17;max-width:32rem">',
    `<p style="margin:0 0 1.25rem;font-weight:600">${siteConfig.name}</p>`,
    `<p style="margin:0 0 .75rem">${t.intro}</p>`,
    `<p style="margin:0 0 1.25rem;font-size:30px;font-weight:600;letter-spacing:.18em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${code}</p>`,
    `<p style="margin:0">${t.valid}</p>`,
    `<p style="margin:1.75rem 0 0;font-size:13px;color:#6b675e">${t.ignore}</p>`,
    '</div>',
  ].join('')
  return { subject: t.subject(code), text, html }
}
