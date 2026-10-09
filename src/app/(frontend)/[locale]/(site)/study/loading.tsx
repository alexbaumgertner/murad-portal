import { useTranslations } from 'next-intl'

import styles from './page.module.css'

/** Shown while a per-student page reads her program; the text is the same for «ты» and «вы». */
export default function StudyLoading() {
  const t = useTranslations('StudyToday')
  return (
    <div className={styles.page} role="status" aria-live="polite">
      <p className={styles.lead}>{t('loading')}</p>
    </div>
  )
}
