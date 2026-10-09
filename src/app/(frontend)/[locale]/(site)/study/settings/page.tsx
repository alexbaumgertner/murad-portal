import type { Metadata } from 'next'
import { createTranslator, hasLocale, NextIntlClientProvider } from 'next-intl'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { StudySettings } from '@/components/StudySettings/StudySettings'
import { currentStudent } from '@/features/auth/current-user'
import { messagesFor, parseAddressForm, studentMessages } from '@/i18n/address-form'
import { Link, redirect } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getPayloadClient } from '@/lib/payload'

import styles from '../page.module.css'

// Per-student page: always read the session.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = createTranslator({
    locale,
    messages: messagesFor(locale, 'ty'),
    namespace: 'StudySettings',
  })
  return { title: t('title'), robots: { index: false } }
}

/** `/study/settings`: how the interface addresses her, «ты» or «вы» (story 011c). */
export default async function StudySettingsPage({ params }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const student = await currentStudent(await getPayloadClient(), await headers())
  if (!student) return redirect({ href: '/login', locale })

  const addressForm = parseAddressForm(student.addressForm)
  const t = createTranslator({
    locale,
    messages: messagesFor(locale, addressForm),
    namespace: 'StudySettings',
  })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('title')}</h1>
        <Link href="/study" className={styles.back}>
          {t('back')}
        </Link>
      </header>
      <NextIntlClientProvider locale={locale} messages={studentMessages(locale, addressForm)}>
        <StudySettings addressForm={addressForm} />
      </NextIntlClientProvider>
    </div>
  )
}
