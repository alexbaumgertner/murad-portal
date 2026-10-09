import { hasLocale } from 'next-intl'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'

import { localizedPath } from '@/i18n/alternates'
import { routing } from '@/i18n/routing'

/**
 * Replaces Payload's "unauthorized" view. The only signed-in users without admin access are
 * students (story 011, criterion 6): send them to their study page in their own language.
 */
export function StudentRedirect({ initPageResult }: AdminViewServerProps): never {
  const locale = initPageResult.req.user?.locale
  redirect(
    localizedPath('/study', hasLocale(routing.locales, locale) ? locale : routing.defaultLocale),
  )
}
