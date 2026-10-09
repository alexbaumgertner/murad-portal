import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { StudySettings } from '@/components/StudySettings/StudySettings'
import type { SettingsState } from '@/features/students/schema'
import { messagesFor } from '@/i18n/address-form'

const { saveStudySettingsAction } = vi.hoisted(() => ({
  saveStudySettingsAction:
    vi.fn<(prev: SettingsState, formData: FormData) => Promise<SettingsState>>(),
}))
vi.mock('@/features/students/actions', () => ({ saveStudySettingsAction }))

const renderSettings = (form: 'ty' | 'vy' = 'ty', locale: 'ru' | 'en' = 'ru') =>
  render(
    <NextIntlClientProvider locale={locale} messages={messagesFor(locale, form)}>
      <StudySettings addressForm={form} />
    </NextIntlClientProvider>,
  )

describe('StudySettings', () => {
  beforeEach(() => {
    saveStudySettingsAction.mockReset()
  })

  test('shows the current form selected', async () => {
    await renderSettings('vy')
    await expect.element(page.getByRole('radio', { name: 'Обращаться на «вы»' })).toBeChecked()
    await expect.element(page.getByRole('radio', { name: 'Обращаться на «ты»' })).not.toBeChecked()
  })

  test('picks «вы», saves and confirms', async () => {
    saveStudySettingsAction.mockImplementation(async (_prev, formData) => ({
      status: 'success',
      addressForm: formData.get('addressForm') === 'vy' ? 'vy' : 'ty',
    }))
    await renderSettings('ty')

    await page.getByRole('radio', { name: 'Обращаться на «вы»' }).click()
    await page.getByRole('button', { name: 'Сохранить' }).click()

    await expect.element(page.getByRole('status')).toHaveTextContent('Сохранено')
    expect(saveStudySettingsAction.mock.calls[0]?.[1].get('addressForm')).toBe('vy')
  })

  test('speaks «вы» when the student chose it', async () => {
    await renderSettings('vy')
    await expect.element(page.getByText('Как к вам обращаться')).toBeVisible()
  })

  test('translates an error code', async () => {
    saveStudySettingsAction.mockResolvedValue({ status: 'error', error: 'unauthorized' })
    await renderSettings('ty')

    await page.getByRole('button', { name: 'Сохранить' }).click()

    await expect.element(page.getByRole('alert')).toHaveTextContent('Войди, чтобы изменить настройки.')
  })

  test('is in English for an English student, «вы» or not', async () => {
    await renderSettings('vy', 'en')
    await expect.element(page.getByRole('button', { name: 'Save' })).toBeVisible()
  })
})
