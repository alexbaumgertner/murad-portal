'use client'

import { useTranslations } from 'next-intl'

import { EditableText } from '@/components/EditableText/EditableText'
import { saveHeaderAction, saveNoteAction } from '@/features/planner/actions'
import type { Labels } from '@/features/planner/schema'
import { MAX_LABEL, MAX_NOTE, NOTE_KINDS, type NoteKind } from '@/features/planner/shape'

import styles from './PlannerDiary.module.css'

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

type Props = {
  plannerId: number
  weekId: number
  labels: Labels
  notes: Record<string, string>
  /** The owner edits headings and day names; the student writes entries. */
  isOwner: boolean
}

/** Exercises / Questions: seven entries each, per week (story 023). */
export function PlannerDiary({ plannerId, weekId, labels, notes, isOwner }: Props) {
  const t = useTranslations('Planner')
  const saveLabels = (patch: Labels) =>
    saveHeaderAction({ plannerId, labels: patch }).then((r) => r.status === 'success')

  return (
    <div className={styles.columns}>
      {NOTE_KINDS.map((kind: NoteKind) => (
        <section key={kind} className={styles.column}>
          <h2 className={styles.title}>
            <EditableText
              value={labels[kind] ?? t(`header.${kind}`)}
              label={t(`header.${kind}Label`)}
              canEdit={isOwner}
              maxLength={MAX_LABEL}
              onSave={(value) => saveLabels({ [kind]: value })}
            />
          </h2>
          {DAY_KEYS.map((key, day) => (
            <div key={key} className={styles.entry}>
              <span className={styles.day}>
                <EditableText
                  value={labels.diaryDays?.[day] || t(`days.${key}`)}
                  label={t('header.diaryDayLabel', { day: t(`days.${key}`) })}
                  canEdit={isOwner}
                  maxLength={MAX_LABEL}
                  onSave={(value) => {
                    const days = Array.from({ length: 7 }, (_, i) => labels.diaryDays?.[i] ?? '')
                    days[day] = value
                    return saveLabels({ diaryDays: days })
                  }}
                />
              </span>
              <EditableText
                value={notes[`${kind}-${day}`] ?? ''}
                label={t('header.entryLabel', {
                  kind: labels[kind] ?? t(`header.${kind}`),
                  day: labels.diaryDays?.[day] || t(`days.${key}`),
                })}
                canEdit
                multiline
                maxLength={MAX_NOTE}
                className={styles.text}
                onSave={(text) =>
                  saveNoteAction({ weekId, kind, day, text }).then((r) => r.status === 'success')
                }
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
