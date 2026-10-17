'use client'

import { useTranslations } from 'next-intl'

import type { SyncState } from '@/components/PlannerShell/usePlannerSync'

import styles from './PlannerSyncStatus.module.css'

/** Quiet live-region note: the planner is in sync, or the connection is lost. */
export function PlannerSyncStatus({ state }: { state: SyncState }) {
  const t = useTranslations('Planner.sync')
  return (
    <p
      role="status"
      aria-label={t('label')}
      className={`${styles.status} ${state === 'offline' ? styles.offline : ''}`}
    >
      {t(state)}
    </p>
  )
}
