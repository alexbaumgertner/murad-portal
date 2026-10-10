import { defaultLocale } from '@/i18n/locales'

/** The admin sign-in page that brings the owner back to `path` (the default locale has no prefix). */
export function signInUrl(locale: string, path: string): string {
  const back = locale === defaultLocale ? path : `/${locale}${path}`
  return `/admin/login?redirect=${encodeURIComponent(back)}`
}
