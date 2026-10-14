'use client'

import { useId, useState } from 'react'

import styles from './EditableText.module.css'

type Props = {
  value: string
  /** Saves the new value; resolves false when it failed (the old value is put back). */
  onSave: (value: string) => Promise<boolean>
  canEdit: boolean
  label: string
  placeholder?: string
  maxLength: number
  multiline?: boolean
  className?: string
}

/**
 * Click-to-edit plain text (story 023). Single line: Enter saves, Escape cancels. Multi-line:
 * Enter is a line break. Blur saves. Read-only viewers get plain text; the value is never HTML.
 */
export function EditableText({
  value,
  onSave,
  canEdit,
  label,
  placeholder,
  maxLength,
  multiline,
  className,
}: Props) {
  const [text, setText] = useState(value)
  const [saved, setSaved] = useState(value)
  const id = useId()

  if (!canEdit)
    return <span className={`${styles.read} ${className ?? ''}`}>{value || placeholder || ''}</span>

  async function commit() {
    const next = text.trim()
    setText(next)
    if (next === saved) return
    const before = saved
    setSaved(next)
    if (!(await onSave(next))) {
      setSaved(before)
      setText(before)
    }
  }

  const common = {
    id,
    'aria-label': label,
    className: `${styles.field} ${className ?? ''}`,
    value: text,
    placeholder,
    maxLength,
    onChange: (event: { target: { value: string } }) => setText(event.target.value),
    onBlur: () => void commit(),
  }
  return multiline ? (
    <textarea
      {...common}
      rows={1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setText(saved)
          event.currentTarget.blur()
        }
      }}
    />
  ) : (
    <input
      {...common}
      type="text"
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          const input = event.currentTarget
          setText(saved)
          // Blur after React applies the reverted value, so the blur does not save the edit.
          queueMicrotask(() => input.blur())
        }
      }}
    />
  )
}
