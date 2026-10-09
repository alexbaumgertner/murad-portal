import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { StudentLogin } from '@/components/StudentLogin/StudentLogin'
import { alternatesFor } from '@/i18n/alternates'
import { routing } from '@/i18n/routing'

import styles from './page.module.css'

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Login' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor('/login', locale),
    robots: { index: false },
  }
}

export default async function LoginPage({ params }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const t = await getTranslations({ locale, namespace: 'Login' })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.lead}>{t('lead')}</p>
      </header>
      <StudentLogin />
    </div>
  )
}
