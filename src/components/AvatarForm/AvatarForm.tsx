'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useId, useState } from 'react'

import { removeAvatarAction, saveAvatarAction } from '@/features/students/actions'
import { initialAvatarState } from '@/features/students/schema'
import { AVATAR_MIME_TYPES } from '@/features/students/shape'

import styles from './AvatarForm.module.css'

/** Profile picture on /study/settings (story 021): pick, upload, remove. Errors come back as codes. */
export function AvatarForm({ hasAvatar }: { hasAvatar: boolean }) {
  const t = useTranslations('StudySettings.avatar')
  const [saved, saveAction, isSaving] = useActionState(saveAvatarAction, initialAvatarState)
  const [removed, removeAction, isRemoving] = useActionState(removeAvatarAction, initialAvatarState)
  const [picked, setPicked] = useState('')
  const hintId = useId()
  const pending = isSaving || isRemoving
  // Whichever action ran last decides the message.
  const state =
    saved.status !== 'idle' && removed.status === 'idle'
      ? saved
      : removed.status !== 'idle'
        ? removed
        : saved

  return (
    <div className={styles.wrap}>
      <form action={saveAction} className={styles.form}>
        <fieldset className={styles.fieldset} disabled={pending} aria-describedby={hintId}>
          <legend className={styles.legend}>{t('legend')}</legend>
          <label className={styles.pick}>
            <span className={styles.pickButton}>{t('choose')}</span>
            <input
              type="file"
              name="avatar"
              accept={AVATAR_MIME_TYPES.join(',')}
              className={styles.input}
              onChange={(event) => setPicked(event.target.files?.[0]?.name ?? '')}
            />
          </label>
          {picked ? <span className={styles.picked}>{picked}</span> : null}
          <p id={hintId} className={styles.hint}>
            {t('hint')}
          </p>
        </fieldset>
        <button type="submit" className={styles.button} disabled={pending}>
          {isSaving ? t('pending') : t('upload')}
        </button>
      </form>
      {hasAvatar ? (
        <form action={removeAction}>
          <button type="submit" className={styles.button} disabled={pending}>
            {t('remove')}
          </button>
        </form>
      ) : null}
      <p
        className={state.status === 'error' ? styles.error : styles.success}
        role={state.status === 'error' ? 'alert' : 'status'}
      >
        {state.status === 'error' ? t(`errors.${state.error}`) : null}
        {state.status === 'success' ? t(state.removed ? 'removed' : 'saved') : null}
      </p>
    </div>
  )
}
