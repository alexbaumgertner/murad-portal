import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { DayComment } from '@/components/DayComment/DayComment'
import type { CommentActionState } from '@/features/day-comments/schema'
import { messagesFor } from '@/i18n/address-form'

const { saveDayCommentAction } = vi.hoisted(() => ({
  saveDayCommentAction: vi.fn<(input: unknown) => Promise<CommentActionState>>(),
}))
vi.mock('@/features/day-comments/actions', () => ({ saveDayCommentAction }))

const renderComment = (initialText = '', locale: 'ru' | 'en' = 'ru', form: 'ty' | 'vy' = 'ty') =>
  render(
    <NextIntlClientProvider locale={locale} messages={messagesFor(locale, form)}>
      <DayComment date="2026-10-10" initialText={initialText} />
    </NextIntlClientProvider>,
  )

describe('DayComment (story 016)', () => {
  beforeEach(() => {
    saveDayCommentAction.mockReset()
  })

  test('1. an empty day shows the field and saves the text for that date', async () => {
    saveDayCommentAction.mockResolvedValue({ status: 'success', saved: true })
    await renderComment()
    const field = page.getByLabelText('Комментарий к дню')
    await expect.element(field).toHaveValue('')
    await userEvent.fill(field, 'Не понял Present Perfect в серии 3')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    expect(saveDayCommentAction).toHaveBeenCalledWith({
      date: '2026-10-10',
      text: 'Не понял Present Perfect в серии 3',
    })
    await expect.element(page.getByRole('status')).toHaveTextContent('Сохранено')
  })

  test('3. an existing comment is prefilled; clearing it saves an empty text', async () => {
    saveDayCommentAction.mockResolvedValue({ status: 'success', saved: false })
    await renderComment('Было тяжело')
    const field = page.getByLabelText('Комментарий к дню')
    await expect.element(field).toHaveValue('Было тяжело')
    await userEvent.clear(field)
    await page.getByRole('button', { name: 'Сохранить' }).click()
    expect(saveDayCommentAction).toHaveBeenCalledWith({ date: '2026-10-10', text: '' })
    await expect.element(page.getByRole('status')).toHaveTextContent('Комментарий удалён')
  })

  test('4. 1001 characters show «Не больше 1000 символов» and nothing is sent', async () => {
    await renderComment()
    const field = page.getByLabelText('Комментарий к дню')
    await userEvent.fill(field, 'a'.repeat(1001))
    await expect.element(page.getByRole('alert')).toHaveTextContent('Не больше 1000 символов')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    expect(saveDayCommentAction).not.toHaveBeenCalled()
    // the typed text is kept
    await expect.element(field).toHaveValue('a'.repeat(1001))
  })

  test('a server error keeps the text and says so', async () => {
    saveDayCommentAction.mockResolvedValue({ status: 'error', error: 'server' })
    await renderComment()
    const field = page.getByLabelText('Комментарий к дню')
    await userEvent.fill(field, 'текст')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expect.element(page.getByRole('alert')).toBeVisible()
    await expect.element(field).toHaveValue('текст')
    await expect.element(page.getByRole('button', { name: 'Сохранить' })).toBeEnabled()
  })

  test('while saving the button is disabled', async () => {
    let finish: (state: CommentActionState) => void = () => {}
    saveDayCommentAction.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    await renderComment()
    await userEvent.fill(page.getByLabelText('Комментарий к дню'), 'x')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expect.element(page.getByRole('button', { name: 'Сохраняю…' })).toBeDisabled()
    finish({ status: 'success', saved: true })
    await expect.element(page.getByRole('status')).toHaveTextContent('Сохранено')
  })

  test('«вы» and English copy', async () => {
    await renderComment('', 'ru', 'vy')
    await expect.element(page.getByText(/Напишите/)).toBeVisible()
  })

  test('English', async () => {
    await renderComment('', 'en')
    await expect.element(page.getByLabelText('Comment on this day')).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Save' })).toBeVisible()
  })
})
