import { defineRouting } from 'next-intl/routing'

import { defaultLocale, locales } from './locales'

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Russian is unprefixed (`/`, `/changelog`); English lives under `/en`.
  localePrefix: 'as-needed',
})

export type Locale = (typeof routing.locales)[number]
