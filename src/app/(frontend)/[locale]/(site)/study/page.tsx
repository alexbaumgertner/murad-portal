import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createTranslator, hasLocale, NextIntlClientProvider } from 'next-intl'

import { ProgramCard } from '@/components/ProgramCard/ProgramCard'
import { StartProgram } from '@/components/StartProgram/StartProgram'
import { logoutAction } from '@/features/auth/actions'
import { currentStudent } from '@/features/auth/current-user'
import { getStudyView } from '@/features/enrollments/queries'
import { messagesFor, parseAddressForm, studentMessages } from '@/i18n/address-form'
import { Link, redirect } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getPayloadClient } from '@/lib/payload'

import styles from './page.module.css'

// Per-student page: always read the session.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = createTranslator({ locale, messages: messagesFor(locale, 'ty'), namespace: 'Study' })
  return { title: t('title'), robots: { index: false } }
}

/**
 * The student's home. Story 012: the placement result and the assigned program with «Начать»;
 * once started, «Сегодня» with the program day (the full day view is story 013).
 */
export default async function StudyPage({ params }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const payload = await getPayloadClient()
  const student = await currentStudent(payload, await headers())
  if (!student) return redirect({ href: '/login', locale })
  // «Ты» or «вы» is her setting (story 011c); English ignores it.
  const addressForm = parseAddressForm(student.addressForm)
  const messages = messagesFor(locale, addressForm)
  const t = createTranslator({ locale, messages, namespace: 'Study' })
  const tp = createTranslator({ locale, messages, namespace: 'StudyProgram' })
  const view = await getStudyView(payload, student, locale)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {student.name ? t('greeting', { name: student.name }) : t('greetingAnonymous')}
        </h1>
        {view.kind === 'none' ? <p className={styles.lead}>{t('empty')}</p> : null}
        {view.kind === 'assigned' ? (
          <p className={styles.lead}>
            {view.placement.score
              ? tp('placementWithScore', {
                  test: view.placement.test ?? tp('testMurad'),
                  score: view.placement.score,
                  cefr: view.placement.cefr,
                })
              : tp('placementNoScore', {
                  test: view.placement.test ?? tp('testMurad'),
                  cefr: view.placement.cefr,
                })}
          </p>
        ) : null}
      </header>

      {view.kind === 'assigned' ? (
        <div className={styles.section}>
          <ProgramCard program={view.program} locale={locale} addressForm={addressForm}>
            <NextIntlClientProvider locale={locale} messages={studentMessages(locale, addressForm)}>
              <StartProgram
                program={tp('levels', { from: view.program.levelFrom, to: view.program.levelTo })}
              />
            </NextIntlClientProvider>
          </ProgramCard>
        </div>
      ) : null}

      {view.kind === 'active' ? (
        <section className={styles.section} aria-labelledby="today-title">
          <h2 id="today-title" className={styles.today}>
            {tp('today')}
          </h2>
          <p className={styles.lead}>
            {tp('levels', { from: view.program.levelFrom, to: view.program.levelTo })} ·{' '}
            {tp('dayOf', { day: view.day, total: view.totalDays })}
          </p>
        </section>
      ) : null}

      <div className={styles.actions}>
        <Link href="/study/settings" className={styles.logout}>
          {t('settingsLink')}
        </Link>
        <form action={logoutAction}>
          <button type="submit" className={styles.logout}>
            {t('logout')}
          </button>
        </form>
      </div>
    </div>
  )
}
