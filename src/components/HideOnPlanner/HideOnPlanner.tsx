'use client'

import type { ReactNode } from 'react'

import { usePathname } from '@/i18n/navigation'

/**
 * The planner starts with its own header (story 034), so the student/site header of /study is not
 * rendered there. Decided on the client so the study layout stays free of the request path.
 */
export function HideOnPlanner({ children }: { children: ReactNode }) {
  return usePathname() === '/study/planner' ? null : children
}
