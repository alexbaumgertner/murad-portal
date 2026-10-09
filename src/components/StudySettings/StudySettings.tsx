'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useId } from 'react'

import { saveStudySettingsAction } from '@/features/students/actions'
import { initialSettingsState } from '@/features/students/schema'
import type { AddressForm } from '@/i18n/address-form'

import styles from './StudySettings.module.css'

const options = ['ty', 'vy'] as const satisfies readonly AddressForm[]

/** The student's own preferences: «ты» or «вы» (story 011c). The page re-renders in the new form after saving. */
export function StudySettings({ addressForm }: { addressForm: AddressForm }) {
  const t = useTranslations('StudySettings')
  const [state, formAction, isPending] = useActionState(
    saveStudySettingsAction,
    initialSettingsState,
  )
  const hintId = useId()
  const statusId = useId()

  return (
    <form action={formAction} className={styles.form}>
      <fieldset className={styles.fieldset} aria-describedby={hintId} disabled={isPending}>
        <legend className={styles.legend}>{t('legend')}</legend>
        {options.map((option) => (
          <label key={option} className={styles.option}>
            <input
              type="radio"
              name="addressForm"
              value={option}
              // React resets the form after an action; the saved value keeps the group on her choice.
              defaultChecked={
                option === (state.status === 'success' ? state.addressForm : addressForm)
              }
            />
            <span>{t(option)}</span>
          </label>
        ))}
      </fieldset>
      <p id={hintId} className={styles.hint}>
        {t('hint')}
      </p>
      <button type="submit" className={styles.button} disabled={isPending}>
        {isPending ? t('pending') : t('save')}
      </button>
      <p
        id={statusId}
        className={state.status === 'error' ? styles.error : styles.success}
        role={state.status === 'error' ? 'alert' : 'status'}
      >
        {state.status === 'error' ? t(`errors.${state.error}`) : null}
        {state.status === 'success' ? t('saved') : null}
      </p>
    </form>
  )
}
