import 'server-only'

import { contentDefaultLocale, defaultLocale, type locales } from '@/i18n/locales'
import { getPayloadClient } from '@/lib/payload'

type Options = { limit?: number; locale?: (typeof locales)[number] }

/** Published entries in `locale`; fields without a translation fall back to English. */
export async function getChangelogEntries({ limit = 20, locale = defaultLocale }: Options = {}) {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'changelog',
    limit,
    locale,
    fallbackLocale: contentDefaultLocale,
    sort: '-publishedAt',
    depth: 0,
    overrideAccess: false,
  })
  return docs
}
