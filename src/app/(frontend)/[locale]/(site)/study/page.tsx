import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'

import { logoutAction } from '@/features/auth/actions'
import { currentStudent } from '@/features/auth/current-user'
import { redirect } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getPayloadClient } from '@/lib/payload'

import styles from './page.module.css'

// Per-student page: always read the session.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Study' })
  return { title: t('title'), robots: { index: false } }
}

/** The student's home. Her plan arrives with stories 012–013; for now a greeting. */
export default async function StudyPage({ params }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const student = await currentStudent(await getPayloadClient(), await headers())
  if (!student) return redirect({ href: '/login', locale })
  const t = await getTranslations({ locale, namespace: 'Study' })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {student.name ? t('greeting', { name: student.name }) : t('greetingAnonymous')}
        </h1>
        <p className={styles.lead}>{t('empty')}</p>
      </header>
      <form action={logoutAction}>
        <button type="submit" className={styles.logout}>
          {t('logout')}
        </button>
      </form>
    </div>
  )
}
