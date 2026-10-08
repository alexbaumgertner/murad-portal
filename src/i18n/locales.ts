// Locale codes shared by next-intl and Payload; no framework imports (the Payload CLI loads it).
export const locales = ['en', 'ru'] as const
export const defaultLocale = 'ru'
// Keep existing CMS content and untranslated changelog entries in English.
export const contentDefaultLocale = 'en'
export const localeLabels: Record<(typeof locales)[number], string> = {
  en: 'English',
  ru: 'Русский',
}
