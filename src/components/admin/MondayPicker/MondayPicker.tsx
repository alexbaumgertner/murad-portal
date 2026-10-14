'use client'

import { FieldLabel, useField } from '@payloadcms/ui'
import type { TextFieldClientProps } from 'payload'

import { isIsoDate, mondayOf } from '@/features/planner/shape'

import styles from './MondayPicker.module.css'

/**
 * Calendar for the planner's first Monday. The browser's date input cannot grey out other weekdays,
 * so any picked day snaps to the Monday of its week; the value stays the plain `YYYY-MM-DD` text.
 */
export function MondayPicker({ field, path }: TextFieldClientProps) {
  const { value, setValue, showError, errorMessage } = useField<string>({
    path: path ?? field.name,
  })
  const current = typeof value === 'string' ? value : ''

  return (
    <div className={`field-type ${showError ? 'error' : ''}`}>
      <FieldLabel label={field.label} path={path ?? field.name} required={field.required} />
      <input
        type="date"
        className={styles.input}
        value={current}
        onChange={(event) => {
          const picked = event.target.value
          setValue(isIsoDate(picked) ? mondayOf(picked) : picked)
        }}
      />
      <p className={styles.hint}>Pick any day: it moves to the Monday of that week.</p>
      {showError ? <p className={styles.error}>{errorMessage}</p> : null}
    </div>
  )
}
