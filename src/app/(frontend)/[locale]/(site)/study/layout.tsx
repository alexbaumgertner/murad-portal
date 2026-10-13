import { headers } from 'next/headers'
import type { ReactNode } from 'react'

import { SiteHeader } from '@/components/SiteHeader/SiteHeader'
import { StudentHeader } from '@/components/StudentHeader/StudentHeader'
import { currentUser } from '@/features/auth/current-user'
import { getPayloadClient } from '@/lib/payload'

// The header depends on who is signed in.
export const dynamic = 'force-dynamic'

/**
 * Header of the whole student area (story 021): a student gets her own, without the teacher's
 * site menu; the owner (his /study/students pages) and a visitor who is not signed in keep the
 * full public header, which the locale layout hides under /study.
 */
export default async function StudyLayout({ children }: { children: ReactNode }) {
  const user = await currentUser(await getPayloadClient(), await headers())
  return (
    <>
      {user?.role === 'student' ? (
        <StudentHeader displayName={user.name?.trim() || user.email} />
      ) : (
        <SiteHeader />
      )}
      {children}
    </>
  )
}
