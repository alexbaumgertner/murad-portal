import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

import styles from './SiteFooter.module.css'

export function SiteFooter() {
  const t = useTranslations('Footer')

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p>
          {t('title')} · © {new Date().getFullYear()}
        </p>
        <Link href="/changelog" className={styles.muted}>
          {t('changelog')}
        </Link>
      </div>
    </footer>
  )
}
