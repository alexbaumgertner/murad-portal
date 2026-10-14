'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, type ReactNode } from 'react'

import { PlannerBackgroundSettings } from '@/components/PlannerSettings/PlannerBackgroundSettings'
import { PlannerBarSettings } from '@/components/PlannerSettings/PlannerBarSettings'
import { PlannerColorSettings } from '@/components/PlannerSettings/PlannerColorSettings'
import { PlannerTypographySettings } from '@/components/PlannerSettings/PlannerTypographySettings'

import styles from './PlannerSettings.module.css'

/** The settings drawer: a modal `<dialog>` docked to the right, closed with Esc or the button. */
export function PlannerSettings({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children?: ReactNode
}) {
  const t = useTranslations('Planner.settings')
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} className={styles.drawer} aria-label={t('title')} onClose={onClose}>
      <div className={styles.head}>
        <h2 className={styles.title}>{t('title')}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t('close')}>
          ×
        </button>
      </div>
      <details className={styles.section} open>
        <summary>{t('colors')}</summary>
        <PlannerColorSettings />
      </details>
      <details className={styles.section}>
        <summary>{t('background.title')}</summary>
        <PlannerBackgroundSettings />
      </details>
      <details className={styles.section}>
        <summary>{t('bars.title')}</summary>
        <PlannerBarSettings />
      </details>
      <details className={styles.section}>
        <summary>{t('typography')}</summary>
        <PlannerTypographySettings />
      </details>
      {children}
    </dialog>
  )
}
