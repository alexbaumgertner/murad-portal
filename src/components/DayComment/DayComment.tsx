'use client'

import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'

import { saveDayCommentAction } from '@/features/day-comments/actions'
import type { CommentError } from '@/features/day-comments/schema'
import { MAX_COMMENT_LENGTH } from '@/features/day-comments/shape'

import styles from './DayComment.module.css'

type Props = {
  /** The calendar day (`YYYY-MM-DD`) the comment belongs to: today or a past day, never a future one. */
  date: string
  /** The saved comment, empty when there is none. */
  initialText: string
}

type Notice = { kind: 'saved' | 'deleted' } | { kind: 'error'; error: CommentError } | null

/**
 * The student's private comment on one day (story 016): a question, what was hard. Murad reads it
 * in /admin. Empty text deletes the comment; the text stays in the field when saving fails.
 */
export function DayComment({ date, initialText }: Props) {
  const t = useTranslations('StudyComment')
  const [text, setText] = useState(initialText)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const fieldId = useId()
  const hintId = useId()

  const length = text.trim().length
  const tooLong = length > MAX_COMMENT_LENGTH
  const error = tooLong ? 'too_long' : notice?.kind === 'error' ? notice.error : null

  async function save() {
    if (pending || tooLong) return
    setPending(true)
    setNotice(null)
    try {
      const answer = await saveDayCommentAction({ date, text })
      if (answer.status === 'error') setNotice({ kind: 'error', error: answer.error })
      else setNotice({ kind: answer.saved ? 'saved' : 'deleted' })
    } catch {
      setNotice({ kind: 'error', error: 'server' })
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <label htmlFor={fieldId} className={styles.label}>
        {t('label')}
      </label>
      <p id={hintId} className={styles.hint}>
        {t('hint')}
      </p>
      <textarea
        id={fieldId}
        className={styles.field}
        rows={4}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setNotice(null)
        }}
        aria-describedby={hintId}
        aria-invalid={error ? true : undefined}
      />
      <p className={tooLong ? styles.counterOver : styles.counter}>
        {t('counter', { count: length, max: MAX_COMMENT_LENGTH })}
      </p>
      <div className={styles.row}>
        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? t('pending') : t('save')}
        </button>
        <p className={styles.note} role="status">
          {notice?.kind === 'saved' ? t('saved') : null}
          {notice?.kind === 'deleted' ? t('deleted') : null}
        </p>
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {t(`errors.${error}`)}
        </p>
      ) : null}
    </form>
  )
}
