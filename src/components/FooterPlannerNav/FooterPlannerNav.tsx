'use client'

import { useTranslations } from 'next-intl'

import { LocaleSwitcher } from '@/components/LocaleSwitcher/LocaleSwitcher'
import { logoutAction } from '@/features/auth/actions'
import { Link, usePathname } from '@/i18n/navigation'

import styles from './FooterPlannerNav.module.css'

/** On `/study/planner` the header is gone (story 034): the way back, sign-out and language live here. */
export function FooterPlannerNav() {
  const t = useTranslations('Footer')
  const header = useTranslations('Header')
  if (usePathname() !== '/study/planner') return null

  return (
    <nav aria-label={t('plannerNav')} className={styles.nav}>
      <Link href="/study" className={styles.link}>
        {t('toStudy')}
      </Link>
      <form action={logoutAction}>
        <button type="submit" className={styles.link}>
          {header('signOut')}
        </button>
      </form>
      <LocaleSwitcher />
    </nav>
  )
}
