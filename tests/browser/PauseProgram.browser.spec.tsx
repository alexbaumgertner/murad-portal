import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { PauseProgram } from '@/components/PauseProgram/PauseProgram'
import type { PauseActionState } from '@/features/program-pause/schema'
import { messagesFor } from '@/i18n/address-form'

const { pauseProgramAction, resumeProgramAction, refresh } = vi.hoisted(() => ({
  pauseProgramAction: vi.fn<(input: unknown) => Promise<PauseActionState>>(),
  resumeProgramAction: vi.fn<(input: unknown) => Promise<PauseActionState>>(),
  refresh: vi.fn(),
}))
vi.mock('@/features/program-pause/actions', () => ({ pauseProgramAction, resumeProgramAction }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const renderPause = (paused: boolean, locale: 'ru' | 'en' = 'ru', form: 'ty' | 'vy' = 'ty') =>
  render(
    <NextIntlClientProvider locale={locale} messages={messagesFor(locale, form)}>
      <PauseProgram paused={paused} />
    </NextIntlClientProvider>,
  )

describe('PauseProgram (story 017)', () => {
  beforeEach(() => {
    pauseProgramAction.mockReset()
    resumeProgramAction.mockReset()
    refresh.mockReset()
  })

  test('1. «Пауза» asks first, then pauses and refreshes the page', async () => {
    pauseProgramAction.mockResolvedValue({ status: 'success' })
    await renderPause(false)

    await page.getByRole('button', { name: 'Пауза' }).click()
    await expect.element(page.getByText(/Поставить программу на паузу\?/)).toBeVisible()
    expect(pauseProgramAction).not.toHaveBeenCalled()

    await page.getByRole('button', { name: 'Поставить на паузу' }).click()
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(pauseProgramAction).toHaveBeenCalledTimes(1)
    expect(pauseProgramAction).toHaveBeenCalledWith({}) // nothing from the browser
  })

  test('«Отмена» closes the question and pauses nothing', async () => {
    await renderPause(false)
    await page.getByRole('button', { name: 'Пауза' }).click()
    await page.getByRole('button', { name: 'Отмена' }).click()
    await expect.element(page.getByRole('button', { name: 'Пауза' })).toBeVisible()
    expect(pauseProgramAction).not.toHaveBeenCalled()
  })

  test('loading: the buttons are disabled while the request runs', async () => {
    let finish: (state: PauseActionState) => void = () => {}
    pauseProgramAction.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    await renderPause(false)

    await page.getByRole('button', { name: 'Пауза' }).click()
    await page.getByRole('button', { name: 'Поставить на паузу' }).click()
    await expect.element(page.getByRole('button', { name: 'Ставлю на паузу…' })).toBeDisabled()
    await expect.element(page.getByRole('button', { name: 'Отмена' })).toBeDisabled()

    finish({ status: 'success' })
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  test('error: a code from the server becomes a message and the page stays', async () => {
    pauseProgramAction.mockResolvedValue({ status: 'error', error: 'program_over' })
    await renderPause(false)
    await page.getByRole('button', { name: 'Пауза' }).click()
    await page.getByRole('button', { name: 'Поставить на паузу' }).click()

    await expect.element(page.getByRole('alert')).toHaveTextContent('Программа уже завершена')
    expect(refresh).not.toHaveBeenCalled()
    await expect.element(page.getByRole('button', { name: 'Поставить на паузу' })).toBeEnabled()
  })

  test('2. «Продолжить» resumes at once, without a question', async () => {
    resumeProgramAction.mockResolvedValue({ status: 'success' })
    await renderPause(true)

    await page.getByRole('button', { name: 'Продолжить' }).click()
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(resumeProgramAction).toHaveBeenCalledWith({})
    expect(pauseProgramAction).not.toHaveBeenCalled()
  })

  test('resume error is shown in the form of address of the student («вы»)', async () => {
    resumeProgramAction.mockResolvedValue({ status: 'error', error: 'server' })
    await renderPause(true, 'ru', 'vy')
    await page.getByRole('button', { name: 'Продолжить' }).click()
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('Не получилось. Попробуйте ещё раз')
  })

  test('English', async () => {
    await renderPause(false, 'en')
    await expect.element(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  })
})
