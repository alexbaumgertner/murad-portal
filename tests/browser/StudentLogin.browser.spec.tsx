import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { StudentLogin } from '@/components/StudentLogin/StudentLogin'
import type { LoginState } from '@/features/auth/schema'

import ru from '../../messages/ru.json'

const { loginAction } = vi.hoisted(() => ({
  loginAction: vi.fn<(prev: LoginState, formData: FormData) => Promise<LoginState>>(),
}))
vi.mock('@/features/auth/actions', () => ({ loginAction }))

const renderLogin = () =>
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <StudentLogin />
    </NextIntlClientProvider>,
  )

describe('StudentLogin', () => {
  beforeEach(() => {
    loginAction.mockReset()
  })

  test('asks for the code with the neutral message and sends the page locale', async () => {
    loginAction.mockImplementation(async (_prev, formData) => ({
      step: 'code',
      email: String(formData.get('email')),
    }))
    await renderLogin()

    await page.getByLabelText('Почта').fill('anna@example.com')
    await page.getByRole('button', { name: 'Получить код' }).click()

    await expect.element(page.getByText('Если адрес есть в списке, код уже в почте')).toBeVisible()
    await expect.element(page.getByLabelText('Код из письма')).toBeVisible()
    const formData = loginAction.mock.calls[0]?.[1]
    expect(formData?.get('intent')).toBe('request')
    expect(formData?.get('locale')).toBe('ru')
  })

  test.each([
    ['rate_limited', 'Слишком много попыток, подожди 15 минут'],
    ['code_expired', 'Код устарел, запроси новый'],
  ] as const)('translates %s', async (error, message) => {
    loginAction
      .mockResolvedValueOnce({ step: 'code', email: 'anna@example.com' })
      .mockResolvedValueOnce({ step: 'code', email: 'anna@example.com', error })
    await renderLogin()

    await page.getByLabelText('Почта').fill('anna@example.com')
    await page.getByRole('button', { name: 'Получить код' }).click()
    await page.getByLabelText('Код из письма').fill('123456')
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect.element(page.getByRole('alert')).toHaveTextContent(message)
    await expect
      .element(page.getByLabelText('Код из письма'))
      .toHaveAttribute('aria-invalid', 'true')
  })
})
