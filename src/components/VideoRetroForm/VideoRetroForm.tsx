'use client'

import { useActionState, useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { saveVideoRetroAction } from '@/features/challenge/actions'
import {
  retroFields,
  type VideoRetroInput,
  type VideoRetroState,
} from '@/features/challenge/schema'
import styles from './VideoRetroForm.module.css'

export function VideoRetroForm({ slug, blockNumber, ...initial }: VideoRetroInput) {
  const t = useTranslations('Challenge.videoRetro')
  const id = useId()
  const details = useRef<HTMLDetailsElement>(null)
  const [values, setValues] = useState(initial)
  const [state, formAction, pending] = useActionState(
    async (prev: VideoRetroState, data: FormData) => {
      const next = await saveVideoRetroAction(prev, data)
      if (next.status === 'success' && details.current) details.current.open = false
      return next
    },
    { status: 'idle' } as VideoRetroState,
  )
  const error = state.status === 'error' ? state.error : null
  const fields = ['youtubeUrl', 'publishedAt', ...retroFields] as const
  return (
    <details ref={details} className={styles.panel}>
      <summary className={styles.toggle}>{t('edit')}</summary>
      <form action={formAction} className={styles.form} noValidate>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="blockNumber" value={blockNumber} />
        {fields.map((key) => {
          const props = {
            id: `${id}-${key}`,
            name: key,
            value: values[key],
            className: styles.input,
            readOnly: pending,
            'aria-describedby': error ? `${id}-error` : undefined,
            'aria-invalid':
              error ===
              (key === 'youtubeUrl'
                ? 'invalid_url'
                : key === 'publishedAt'
                  ? 'invalid_date'
                  : 'invalid_retro'),
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              setValues({ ...values, [key]: event.target.value }),
          }
          return (
            <div key={key}>
              <label htmlFor={props.id}>{t(key)}</label>
              {key === 'youtubeUrl' || key === 'publishedAt' ? (
                <input {...props} type={key === 'youtubeUrl' ? 'url' : 'date'} />
              ) : (
                <textarea {...props} rows={3} />
              )}
            </div>
          )
        })}
        <button className={styles.button} disabled={pending}>
          {pending ? t('pending') : t('submit')}
        </button>
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error ? t(`errors.${error}`) : null}
        </p>
      </form>
    </details>
  )
}
