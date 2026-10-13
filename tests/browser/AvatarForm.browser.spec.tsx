import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { AvatarForm } from '@/components/AvatarForm/AvatarForm'
import type { AvatarState } from '@/features/students/schema'
import { messagesFor } from '@/i18n/address-form'

const { saveAvatarAction, removeAvatarAction } = vi.hoisted(() => ({
  saveAvatarAction: vi.fn<(prev: AvatarState, formData: FormData) => Promise<AvatarState>>(),
  removeAvatarAction: vi.fn<() => Promise<AvatarState>>(),
}))
vi.mock('@/features/students/actions', () => ({ saveAvatarAction, removeAvatarAction }))

const renderForm = (hasAvatar: boolean, form: 'ty' | 'vy' = 'ty') =>
  render(
    <NextIntlClientProvider locale="ru" messages={messagesFor('ru', form)}>
      <AvatarForm hasAvatar={hasAvatar} />
    </NextIntlClientProvider>,
  )

describe('AvatarForm (story 021)', () => {
  beforeEach(() => {
    saveAvatarAction.mockReset()
    removeAvatarAction.mockReset()
  })

  test('uploads the picked file and confirms', async () => {
    saveAvatarAction.mockResolvedValue({ status: 'success', removed: false })
    await renderForm(false)

    await page
      .getByLabelText('Выбрать фото')
      .upload(new File(['x'], 'me.png', { type: 'image/png' }))
    await page.getByRole('button', { name: 'Загрузить' }).click()

    await expect.element(page.getByRole('status')).toHaveTextContent('Фото сохранено')
    expect((saveAvatarAction.mock.calls[0]?.[1].get('avatar') as File).name).toBe('me.png')
  })

  test('offers removal only when there is a photo, and confirms it', async () => {
    removeAvatarAction.mockResolvedValue({ status: 'success', removed: true })
    await renderForm(true)

    await page.getByRole('button', { name: 'Убрать фото' }).click()

    await expect.element(page.getByRole('status')).toHaveTextContent('Фото удалено')
  })

  test('hides «Убрать фото» without a photo', async () => {
    await renderForm(false)
    await expect.element(page.getByRole('button', { name: 'Убрать фото' })).not.toBeInTheDocument()
  })

  test('translates an error code, in «вы» too', async () => {
    saveAvatarAction.mockResolvedValue({ status: 'error', error: 'too_large' })
    await renderForm(false, 'vy')

    await page.getByRole('button', { name: 'Загрузить' }).click()

    await expect.element(page.getByRole('alert')).toHaveTextContent('Фото больше 2 МБ.')
  })
})
