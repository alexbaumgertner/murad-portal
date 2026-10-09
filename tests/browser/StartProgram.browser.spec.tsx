import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { StartProgram } from '@/components/StartProgram/StartProgram'
import type { StartState } from '@/features/enrollments/schema'
import { messagesFor } from '@/i18n/address-form'

const { startProgramAction, refresh } = vi.hoisted(() => ({
  startProgramAction: vi.fn<(prev: StartState, formData: FormData) => Promise<StartState>>(),
  refresh: vi.fn(),
}))
vi.mock('@/features/enrollments/actions', () => ({ startProgramAction }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const renderStart = (locale: 'ru' | 'en' = 'ru', form: 'ty' | 'vy' = 'ty') =>
  render(
    <NextIntlClientProvider locale={locale} messages={messagesFor(locale, form)}>
      <StartProgram program="A2 → B1" />
    </NextIntlClientProvider>,
  )

/** Make the browser report a zone (or none at all) for the next render. */
function browserZone(timeZone: string | undefined) {
  const original = Intl.DateTimeFormat.prototype.resolvedOptions
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...original.call(this), timeZone } as Intl.ResolvedDateTimeFormatOptions
  })
}

describe('StartProgram (story 012)', () => {
  beforeEach(() => {
    startProgramAction.mockReset()
    refresh.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('3. asks «Начать A2 → B1 сегодня?» and sends the browser zone', async () => {
    browserZone('Europe/Moscow')
    startProgramAction.mockResolvedValue({ status: 'success' })
    await renderStart()

    await expect.element(page.getByText('Часовой пояс: Moscow (изменить)')).toBeVisible()
    await page.getByRole('button', { name: 'Начать' }).click()
    await expect.element(page.getByText('Начать A2 → B1 сегодня?')).toBeVisible()
    await page.getByRole('button', { name: 'Да, начать' }).click()

    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(startProgramAction).toHaveBeenCalledTimes(1)
    expect(startProgramAction.mock.calls[0]?.[1].get('timezone')).toBe('Europe/Moscow')
  })

  test('5. shows Almaty when the browser zone cannot be detected, and lets her change it', async () => {
    browserZone(undefined)
    startProgramAction.mockResolvedValue({ status: 'success' })
    await renderStart()

    await expect.element(page.getByText('Часовой пояс: Алматы (изменить)')).toBeVisible()
    await page.getByRole('button', { name: 'изменить' }).click()
    await page.getByRole('combobox', { name: 'Часовой пояс' }).selectOptions('Asia/Tashkent')

    await page.getByRole('button', { name: 'Начать' }).click()
    await page.getByRole('button', { name: 'Да, начать' }).click()
    await vi.waitFor(() => expect(startProgramAction).toHaveBeenCalled())
    expect(startProgramAction.mock.calls[0]?.[1].get('timezone')).toBe('Asia/Tashkent')
  })

  test('7. a double tap sends one request: the button is disabled while it runs', async () => {
    let finish: (state: StartState) => void = () => {}
    startProgramAction.mockImplementation(() => new Promise((resolve) => (finish = resolve)))
    await renderStart()

    await page.getByRole('button', { name: 'Начать' }).click()
    const yes = page.getByRole('button', { name: /Да, начать|Начинаем/ })
    await yes.click()
    await expect.element(page.getByRole('button', { name: 'Начинаем…' })).toBeDisabled()
    await yes.click({ force: true })
    finish({ status: 'success' })

    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(startProgramAction).toHaveBeenCalledTimes(1)
  })

  test('cancel goes back without starting', async () => {
    await renderStart()
    await page.getByRole('button', { name: 'Начать' }).click()
    await page.getByRole('button', { name: 'Отмена' }).click()
    await expect.element(page.getByRole('button', { name: 'Начать' })).toBeVisible()
    expect(startProgramAction).not.toHaveBeenCalled()
  })

  test('shows a translated error in «вы» and English', async () => {
    startProgramAction.mockResolvedValue({ status: 'error', error: 'server' })
    await renderStart('ru', 'vy')
    await page.getByRole('button', { name: 'Начать' }).click()
    await page.getByRole('button', { name: 'Да, начать' }).click()
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('Не получилось начать. Попробуйте ещё раз.')
  })

  test('speaks English', async () => {
    browserZone(undefined)
    await renderStart('en')
    await expect.element(page.getByText('Time zone: Almaty (change)')).toBeVisible()
    await page.getByRole('button', { name: 'Start' }).click()
    await expect.element(page.getByText('Start A2 → B1 today?')).toBeVisible()
  })
})
