'use client'

import type { ReactNode } from 'react'

import { usePathname } from '@/i18n/navigation'

/**
 * The public site header hides under /study: that area renders its own header in
 * `study/layout.tsx` (student menu, or the full menu again for the owner). Doing it here keeps
 * the locale layout static for the public pages.
 */
export function HeaderSwitch({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname === '/study' || pathname.startsWith('/study/')) return null
  return children
}
