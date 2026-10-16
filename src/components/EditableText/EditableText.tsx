'use client'

import { useId, useState } from 'react'

import styles from './EditableText.module.css'

type Draft = { value: string; base: string; saved: string }

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
  const [draft, setDraft] = useState<Draft | null>(null)
  const [held, setHeld] = useState(false)
  const id = useId()

  // The server value wins unless the field is in focus, a save is in flight, or the server has not
  // caught up with our own saved value yet (then the draft keeps the optimistic text).
  const keep = draft !== null && (held || value === draft.base)
  const text = keep ? draft.value : value

  if (draft && !held && value !== draft.base) setDraft(null)

  if (!canEdit)
    return <span className={`${styles.read} ${className ?? ''}`}>{value || placeholder || ''}</span>

  const edit = (next: string) =>
    setDraft({ value: next, base: draft?.base ?? value, saved: draft?.saved ?? text })

  async function commit(field: HTMLElement) {
    const next = text.trim()
    const saved = draft?.saved ?? value
    if (next === saved) {
      setDraft(draft && { ...draft, value: next })
      setHeld(false)
      return
    }
    // Re-base on the server value we see now: our text stays until the server moves on from it.
    const base = value
    setDraft({ value: next, base, saved: next })
    const ok = await onSave(next)
    // Typing since the blur is a newer draft: keep it, the next blur saves it.
    if (!ok)
      setDraft((now) =>
        now && now.value !== next ? { ...now, saved } : { value: saved, base, saved },
      )
    // The field may have been refocused while the save was in flight.
    setHeld(field.ownerDocument.activeElement === field)
  }

  const revert = () => setDraft(draft && { ...draft, value: draft.saved })

  const common = {
    id,
    'aria-label': label,
    className: `${styles.field} ${className ?? ''}`,
    value: text,
    placeholder,
    maxLength,
    onFocus: () => {
      setDraft((current) => current ?? { value: text, base: value, saved: text })
      setHeld(true)
    },
    onChange: (event: { target: { value: string } }) => edit(event.target.value),
    onBlur: (event: { currentTarget: HTMLElement }) => void commit(event.currentTarget),
  }
  return multiline ? (
    <textarea
      {...common}
      rows={1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          const field = event.currentTarget
          revert()
          queueMicrotask(() => field.blur())
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
          revert()
          // Blur after React applies the reverted value, so the blur does not save the edit.
          queueMicrotask(() => input.blur())
        }
      }}
    />
  )
}
