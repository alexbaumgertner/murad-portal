import { expect, test, type Page } from '@playwright/test'

import { clearTestLoginCodes, E2E_CODE, issueKnownCode } from '../helpers/login'
import { SESSION_COOKIE } from '../../src/features/auth/session'
import { cleanupTestUser, seedTestUser, setAddressForm } from '../helpers/seedUser'

const DAY_SECONDS = 24 * 60 * 60

async function requestStudentCode(page: Page, email: string) {
  await clearTestLoginCodes(email)
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `e2e:${email}` })
  await page.goto('/login')
  await page.getByLabel('Почта').fill(email)
  await page.getByRole('button', { name: 'Получить код' }).click()
  await expect(page.getByText('Если адрес есть в списке, код уже в почте')).toBeVisible()
}

test.describe('Student sign-in (story 011b)', () => {
  test('an invited student signs in on /login, lands on /study and cannot open /admin', async ({
    page,
  }, testInfo) => {
    const suffix = `student-${testInfo.project.name}`
    const email = await seedTestUser(suffix, 'student')
    try {
      await requestStudentCode(page, email)
      await issueKnownCode(email)
      await page.getByLabel('Код из письма').fill(E2E_CODE)
      await page.getByRole('button', { name: 'Войти' }).click()

      await page.waitForURL(/\/study$/)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

      const session = (await page.context().cookies()).find((c) => c.name === SESSION_COOKIE)
      const daysLeft = ((session?.expires ?? 0) - Date.now() / 1000) / DAY_SECONDS
      expect(daysLeft).toBeGreaterThan(29)
      expect(daysLeft).toBeLessThanOrEqual(30)

      await page.goto('/admin')
      await page.waitForURL(/\/study$/)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    } finally {
      await cleanupTestUser(suffix)
    }
  })

  test('an address that was not invited gets the same neutral answer', async ({
    page,
  }, testInfo) => {
    await requestStudentCode(page, `uninvited-${testInfo.project.name}-${Date.now()}@example.com`)
    await expect(page.getByLabel('Код из письма')).toBeVisible()
  })

  test('/study sends a signed-out visitor to /login', async ({ page }) => {
    await page.goto('/study')
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('«Ты» / «вы» (story 011c)', () => {
  test('a student switches to «вы» on /study/settings and the texts follow', async ({
    page,
  }, testInfo) => {
    const suffix = `address-${testInfo.project.name}`
    const email = await seedTestUser(suffix, 'student')
    try {
      await requestStudentCode(page, email)
      await issueKnownCode(email)
      await page.getByLabel('Код из письма').fill(E2E_CODE)
      await page.getByRole('button', { name: 'Войти' }).click()
      await page.waitForURL(/\/study$/)
      await expect(page.getByText('Здесь появится твой план занятий')).toBeVisible()

      await page.getByRole('link', { name: 'Настройки' }).click()
      await page.waitForURL(/\/study\/settings$/)
      await page.getByRole('radio', { name: 'Обращаться на «вы»' }).check()
      await page.getByRole('button', { name: 'Сохранить' }).click()
      await expect(page.getByText('Сохранено')).toBeVisible()
      await expect(page.getByText('Как к вам обращаться')).toBeVisible()

      await page.goto('/study')
      await expect(page.getByText('Здесь появится ваш план занятий')).toBeVisible()

      // The signed-out login page remembers the choice.
      await page.context().clearCookies({ name: SESSION_COOKIE })
      await page.goto('/login')
      await expect(page.getByText('Введите почту')).toBeVisible()
    } finally {
      await cleanupTestUser(suffix)
    }
  })

  test('/study/settings sends a signed-out visitor to /login', async ({ page }) => {
    await page.goto('/study/settings')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('English texts do not change for «вы»', async ({ page }, testInfo) => {
    const suffix = `address-en-${testInfo.project.name}`
    const email = await seedTestUser(suffix, 'student')
    try {
      await setAddressForm(email, 'vy')
      await requestStudentCode(page, email)
      await issueKnownCode(email)
      await page.getByLabel('Код из письма').fill(E2E_CODE)
      await page.getByRole('button', { name: 'Войти' }).click()
      await page.waitForURL(/\/study$/)
      await page.goto('/en/study')
      await expect(page.getByText('Your study plan will appear here')).toBeVisible()
    } finally {
      await cleanupTestUser(suffix)
    }
  })
})
