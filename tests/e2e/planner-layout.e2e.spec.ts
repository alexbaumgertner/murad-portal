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

async function seedPlanner(email: string, withPlanner: boolean) {
  const payload = await getPayload({ config })
  const student = (
    await payload.find({ collection: 'users', where: { email: { equals: email } }, depth: 0 })
  ).docs[0]!
  if (!withPlanner) return
  const planner = await payload.create({
    collection: 'planners',
    data: { student: student.id, baseDate: '2026-12-28' },
  })
  for (const index of [0, 1])
    await payload.create({
      collection: 'planner-weeks',
      data: { planner: planner.id, index, rowCount: 1 },
    })
}

test.describe('Planner layout (story 034)', () => {
  test('1/2/3/5. full width, header first, weeks under it, nav in the footer', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop layout')
    const email = await seedTestUser(`layout-${testInfo.project.name}`, 'student')
    try {
      await seedPlanner(email, true)
      await page.setViewportSize({ width: 1920, height: 1000 })
      await signIn(page, email)
      await page.goto('/study/planner')

      await expect(page.getByRole('banner')).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Назад' })).toHaveCount(0)
      const title = await page.getByRole('heading', { name: /РАСПИСАНИЕ/ }).boundingBox()
      const weeks = await page.getByRole('navigation', { name: 'Недели' }).boundingBox()
      const grid = await page.getByRole('table').boundingBox()
      const sheetTop = await page.locator('article').boundingBox()
      expect(sheetTop!.y).toBeLessThan(40)
      expect(weeks!.y).toBeGreaterThan(title!.y)
      expect(weeks!.y).toBeLessThan(grid!.y)

      const sheet = await page.locator('article').boundingBox()
      expect(sheet!.width).toBeGreaterThan(1920 - 120)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true)

      const footer = page.getByRole('contentinfo')
      await expect(footer.getByRole('link', { name: 'К занятиям' })).toBeVisible()
      await expect(footer.getByRole('button', { name: 'Выйти' })).toBeVisible()
      await expect(footer.getByRole('group', { name: /Язык|Language/ })).toBeVisible()

      const current = page.getByRole('link', { name: /Неделя 01/i })
      await expect(current).toHaveAttribute('aria-current', 'page')
      expect(await current.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
        'rgb(26, 24, 21)',
      )
    } finally {
      await cleanupTestUser(email)
    }
  })

  test('4. without a planner the page still has a way back in the footer', async ({
    page,
  }, testInfo) => {
    const email = await seedTestUser(`layout-none-${testInfo.project.name}`, 'student')
    try {
      await signIn(page, email)
      await page.goto('/study/planner')
      await expect(
        page.getByRole('contentinfo').getByRole('link', { name: 'К занятиям' }),
      ).toBeVisible()
    } finally {
      await cleanupTestUser(email)
    }
  })

  test('other /study pages keep the student header', async ({ page }, testInfo) => {
    const email = await seedTestUser(`layout-study-${testInfo.project.name}`, 'student')
    try {
      await signIn(page, email)
      await expect(page.getByRole('banner')).toBeVisible()
      await expect(
        page.getByRole('contentinfo').getByRole('link', { name: 'К занятиям' }),
      ).toHaveCount(0)
    } finally {
      await cleanupTestUser(email)
    }
  })
})
