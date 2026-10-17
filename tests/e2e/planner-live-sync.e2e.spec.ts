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

test.describe('Planner live sync (story 032)', () => {
  test('1–2. the owner and the student see each other’s changes without reloading', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90_000)
    const name = testInfo.project.name
    const ownerEmail = await seedTestUser(`sync-owner-${name}`, 'owner')
    const studentEmail = await seedTestUser(`sync-student-${name}`, 'student')
    const ownerContext = await browser.newContext()
    const studentContext = await browser.newContext()
    try {
      const payload = await getPayload({ config })
      const student = (
        await payload.find({
          collection: 'users',
          where: { email: { equals: studentEmail } },
          depth: 0,
        })
      ).docs[0]!
      const planner = await payload.create({
        collection: 'planners',
        data: { student: student.id, baseDate: '2026-12-28' },
        context: { disableRevalidate: true },
      })
      const week = await payload.create({
        collection: 'planner-weeks',
        data: { planner: planner.id, index: 0, rowCount: 2 },
        context: { disableRevalidate: true },
      })
      await payload.create({
        collection: 'planner-cells',
        data: { week: week.id, row: 0, day: 3, text: 'PODCAST' },
        context: { disableRevalidate: true },
      })

      const ownerPage = await ownerContext.newPage()
      const studentPage = await studentContext.newPage()
      await signIn(ownerPage, ownerEmail)
      await signIn(studentPage, studentEmail)
      await ownerPage.goto(`/study/planner?student=${student.id}`)
      await studentPage.goto('/study/planner')
      await expect(studentPage.getByText('PODCAST').first()).toBeVisible()
      await expect(studentPage.getByRole('status', { name: 'Статус синхронизации' })).toHaveText(
        'Обновлено',
      )

      // 1: the owner writes a task → the student sees it within the poll interval, no reload.
      await payload.create({
        collection: 'planner-cells',
        data: { week: week.id, row: 1, day: 1, text: 'SERIES' },
        context: { disableRevalidate: true },
      })
      await expect(studentPage.getByText('SERIES').first()).toBeVisible({ timeout: 15_000 })

      // 2: the student ticks → the owner's progress updates by itself.
      const progress = ownerPage.getByText('Эта неделя').locator('..')
      await expect(progress).not.toContainText('100%')
      await studentPage.getByRole('button', { name: /Отметить выполненным: PODCAST/ }).click()
      await studentPage.getByRole('button', { name: /Отметить выполненным: SERIES/ }).click()
      await expect(progress).toContainText('100%', { timeout: 15_000 })
    } finally {
      await ownerContext.close()
      await studentContext.close()
      await cleanupTestUser(`sync-owner-${name}`)
      await cleanupTestUser(`sync-student-${name}`)
    }
  })
})
