import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'

import { routing } from './i18n/routing'

const handleLocale = createMiddleware(routing)

export default function proxy(request: NextRequest) {
  // Ignore the browser language, but let next-intl honor an explicit NEXT_LOCALE choice.
  request.headers.set('accept-language', routing.defaultLocale)
  return handleLocale(request)
}

export const config = {
  // Public site only: the Payload admin and API, the Sentry tunnel, Next/Vercel internals and
  // files (anything with a dot) are never localized. Prefixed admin/API paths stay 404s.
  matcher: '/((?!(?:(?:en|ru)/)?(?:admin|api|monitoring)(?:/|$)|_next|_vercel|.*\\..*).*)',
}
