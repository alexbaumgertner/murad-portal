import { useTranslations } from 'next-intl'

import { LocaleSwitcher } from '@/components/LocaleSwitcher/LocaleSwitcher'
import { siteConfig } from '@/config/site'
import { logoutAction } from '@/features/auth/actions'
import { Link } from '@/i18n/navigation'

import styles from './StudentHeader.module.css'

/** Header of the student area (story 021): her own page, who she is, sign out. No teacher menu. */
export function StudentHeader({ displayName }: { displayName: string }) {
  const t = useTranslations('Header')

  return (
    // Rendered inside <main> by the study layout, so the banner role is set explicitly.
    <header role="banner" className={styles.header}>
      <div className={styles.inner}>
        <Link href="/study" className={styles.brand} aria-label={t('study')}>
          <span className={styles.logo} aria-hidden="true" />
          <span className={styles.brandName}>{siteConfig.name}</span>
        </Link>
        <nav aria-label={t('studentNav')} className={styles.navArea}>
          <span className={styles.user} data-testid="header-user">
            {displayName}
          </span>
          <form action={logoutAction}>
            <button type="submit" className={styles.signOut}>
              {t('signOut')}
            </button>
          </form>
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  )
}
