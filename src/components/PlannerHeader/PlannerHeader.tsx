'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { EditableText } from '@/components/EditableText/EditableText'
import { saveHeaderAction } from '@/features/planner/actions'
import type { HeaderView } from '@/features/planner/queries'
import type { Labels } from '@/features/planner/schema'
import { MAX_HEADER_TEXT, MAX_LABEL, MAX_SUBTITLE } from '@/features/planner/shape'

import styles from './PlannerHeader.module.css'

type Props = {
  plannerId: number
  header: HeaderView
  weekIndex: number
  /** Monday of the week on screen. */
  monday: string
  canEdit: boolean
  /** The weekly percent, rendered into the strip. */
  progress: ReactNode
  /** Page-level buttons that must not print. */
  tools: ReactNode
}

/** Dark title bar + narrow strip (story 023). Everything the owner types here is plain text. */
export function PlannerHeader({
  plannerId,
  header,
  weekIndex,
  monday,
  canEdit,
  progress,
  tools,
}: Props) {
  const t = useTranslations('Planner.header')
  const locale = useLocale()
  const save = (patch: {
    studentName?: string
    goal?: string
    subtitle?: string
    labels?: Labels
  }) => saveHeaderAction({ plannerId, ...patch }).then((result) => result.status === 'success')
  const date = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${monday}T12:00:00Z`))
  const labels = header.labels

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <h1 className={styles.title}>
          <EditableText
            value={labels.schedule ?? t('schedule')}
            label={t('scheduleLabel')}
            canEdit={canEdit}
            maxLength={MAX_LABEL}
            className={styles.scheduleLabel}
            onSave={(schedule) => save({ labels: { schedule } })}
          />
          <EditableText
            value={header.studentName}
            label={t('nameLabel')}
            placeholder={t('name')}
            canEdit={canEdit}
            maxLength={MAX_HEADER_TEXT}
            className={styles.name}
            onSave={(studentName) => save({ studentName })}
          />
        </h1>
        <div className={styles.goalBox}>
          <EditableText
            value={labels.goal ?? t('goal')}
            label={t('goalLabelLabel')}
            canEdit={canEdit}
            maxLength={MAX_LABEL}
            className={styles.goalLabel}
            onSave={(goal) => save({ labels: { goal } })}
          />
          <EditableText
            value={header.goal}
            label={t('goalTextLabel')}
            placeholder={t('goalPlaceholder')}
            canEdit={canEdit}
            maxLength={MAX_HEADER_TEXT}
            className={styles.goalText}
            onSave={(goal) => save({ goal })}
          />
        </div>
      </div>
      <div className={styles.strip}>
        <p className={styles.week}>
          {t('week', { n: String(weekIndex + 1).padStart(2, '0') })} · {date}
        </p>
        <EditableText
          value={header.subtitle}
          label={t('subtitleLabel')}
          placeholder={t('subtitlePlaceholder')}
          canEdit={canEdit}
          maxLength={MAX_SUBTITLE}
          className={styles.subtitle}
          onSave={(subtitle) => save({ subtitle })}
        />
        {progress}
        <span className={styles.tools}>{tools}</span>
      </div>
    </header>
  )
}
