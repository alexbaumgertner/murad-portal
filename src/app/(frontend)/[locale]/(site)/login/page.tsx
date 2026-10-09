import type { Metadata } from 'next'
import { createTranslator, hasLocale, NextIntlClientProvider } from 'next-intl'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { StudentLogin } from '@/components/StudentLogin/StudentLogin'
import { alternatesFor } from '@/i18n/alternates'
import {
  ADDRESS_FORM_COOKIE,
  messagesFor,
  parseAddressForm,
  studentMessages,
} from '@/i18n/address-form'
import { routing } from '@/i18n/routing'

import styles from './page.module.css'

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = createTranslator({ locale, messages: messagesFor(locale, 'ty'), namespace: 'Login' })
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
  // A signed-out visitor has no account to read: the «ты»/«вы» cookie set at sign-in and on the
  // settings page is the only hint, and «ты» is the default (story 011c).
  const addressForm = parseAddressForm((await cookies()).get(ADDRESS_FORM_COOKIE)?.value)
  const t = createTranslator({
    locale,
    messages: messagesFor(locale, addressForm),
    namespace: 'Login',
  })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.lead}>{t('lead')}</p>
      </header>
      <NextIntlClientProvider locale={locale} messages={studentMessages(locale, addressForm)}>
        <StudentLogin />
      </NextIntlClientProvider>
    </div>
  )
}
