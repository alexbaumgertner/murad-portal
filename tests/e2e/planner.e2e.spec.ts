import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { clearTestLoginCodes, E2E_CODE, issueKnownCode } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

async function signIn(page: Page, email: string) {
  await clearTestLoginCodes(email)
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `e2e:${email}` })
  await page.goto('/login')
  await page.getByLabel('Почта').fill(email)
  await page.getByRole('button', { name: 'Получить код' }).click()
  await expect(page.getByLabel('Код из письма')).toBeVisible()
  await issueKnownCode(email)
  await page.getByLabel('Код из письма').fill(E2E_CODE)
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL(/\/study$/)
}

test.describe('Weekly planner (story 022)', () => {
  test('1/11/15. a student sees her week, ticks a task, and the tick survives a reload', async ({
    page,
  }, testInfo) => {
    const suffix = `planner-${testInfo.project.name}`
    const email = await seedTestUser(suffix, 'student')
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    try {
      const payload = await getPayload({ config })
      const student = (
        await payload.find({ collection: 'users', where: { email: { equals: email } }, depth: 0 })
      ).docs[0]!
      const planner = await payload.create({
        collection: 'planners',
        data: { student: student.id, baseDate: '2026-12-28' },
      })
      const week = await payload.create({
        collection: 'planner-weeks',
        data: { planner: planner.id, index: 0, rowCount: 1 },
      })
      await payload.create({
        collection: 'planner-cells',
        data: { week: week.id, row: 0, day: 3, text: 'PODCAST' },
      })

      await signIn(page, email)
      await page.goto('/study/planner')
      await expect(page.getByRole('heading', { name: /РАСПИСАНИЕ/ })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /1 янв\.?.*Пятница/ })).toBeVisible()
      const tick = page.getByRole('button', { name: /Отметить выполненным: PODCAST/ })
      await expect(tick).toHaveAttribute('aria-pressed', 'false')
      const saved = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/study/planner'),
      )
      await tick.click()
      await saved
      await expect(tick).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByText('Эта неделя').locator('..')).toContainText('100%')
      await page.reload()
      await expect(page.getByText('Эта неделя').locator('..')).toContainText('100%')
      await expect(
        page.getByRole('button', { name: /Отметить выполненным: PODCAST/ }),
      ).toHaveAttribute('aria-pressed', 'true')
      // 025: the drawer opens, a font applies to the sheet, Cyrillic text keeps a real face
      await page.getByRole('button', { name: 'Настройки' }).click()
      const drawer = page.getByRole('dialog')
      await drawer.getByText('Шрифты', { exact: true }).click()
      await drawer.getByLabel('Шрифт для всех разделов').selectOption('lora')
      await drawer.getByRole('button', { name: 'Применить шрифт ко всем разделам' }).click()
      await drawer.getByRole('button', { name: 'Закрыть настройки' }).click()
      const family = await page
        .getByText('PODCAST')
        .first()
        .evaluate((el) => getComputedStyle(el).fontFamily)
      expect(family).toMatch(/Lora/i)
      await expect
        .poll(() => page.evaluate(() => document.fonts.check('14px Lora', 'Привет')))
        .toBe(true)
      // 7. print: tools are hidden, the sheet stays
      await expect(page.getByRole('button', { name: 'Печать' })).toBeVisible()
      await page.emulateMedia({ media: 'print' })
      await expect(page.getByRole('button', { name: 'Печать' })).toBeHidden()
      await expect(page.getByRole('link', { name: 'Назад' })).toBeHidden()
      await expect(page.getByRole('columnheader', { name: /Пятница/ })).toBeVisible()
      await page.emulateMedia({ media: 'screen' })
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      expect(errors).toEqual([])
    } finally {
      await cleanupTestUser(suffix)
    }
  })
})
