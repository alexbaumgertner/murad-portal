import { useTranslations } from 'next-intl'

import { LocaleSwitcher } from '@/components/LocaleSwitcher/LocaleSwitcher'
import { siteConfig } from '@/config/site'
import { Link } from '@/i18n/navigation'

import styles from './SiteHeader.module.css'

const SECTION_LINKS = [
  { key: 'about', id: 'about' },
  { key: 'approach', id: 'approach' },
  { key: 'materials', id: 'materials' },
  { key: 'exams', id: 'audience' },
  { key: 'faq', id: 'faq' },
] as const

export function SiteHeader() {
  const t = useTranslations('Header')

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label={t('home', { name: siteConfig.name })}>
          {siteConfig.name}
        </Link>
        <nav aria-label={t('nav')} className={styles.navArea}>
          <ul className={styles.nav}>
            {SECTION_LINKS.map(({ key, id }) => (
              <li key={key} className={styles.section}>
                <Link href={`/#${id}`} className={styles.link}>
                  {t(key)}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/challenge" className={styles.link}>
                {t('challenge')}
              </Link>
            </li>
            <li>
              <Link href="/login" className={styles.link}>
                {t('signIn')}
              </Link>
            </li>
          </ul>
          <LocaleSwitcher />
          <a href={siteConfig.telegramUrl} target="_blank" rel="noopener" className={styles.cta}>
            {t('contact')}
          </a>
        </nav>
      </div>
    </header>
  )
}
