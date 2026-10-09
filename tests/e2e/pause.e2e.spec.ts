import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import { addDays } from '../../src/features/enrollments/shape'
import { todayIn } from '../../src/features/enrollments/shape'
import config from '../../src/payload.config'
import { clearTestLoginCodes, E2E_CODE, issueKnownCode } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

const context = { disableRevalidate: true }
const ZONE = 'Asia/Almaty'

/** Every day of the week has one Anki slot of 20 minutes; 8 weeks = 56 days. */
async function seed(suffix: string) {
  const payload = await getPayload({ config })
  await cleanup(suffix)
  const anki = await payload.create({
    collection: 'slot-types',
    context,
    data: { name: `Anki ${suffix}`, defaultMinMinutes: 20 },
  })
  const program = await payload.create({
    collection: 'programs',
    context,
    data: {
      slug: `e2e-pause-${suffix}`,
      title: `E2E пауза ${suffix}`,
      levelFrom: 'B1',
      levelTo: 'B2',
      durationWeeks: 8,
      status: 'published',
      weekTemplate: Array.from({ length: 7 }, () => ({ slots: [{ slotType: anki.id }] })),
    } as never,
  })
  return program
}

async function cleanup(suffix: string) {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'enrollments',
    where: { 'program.slug': { equals: `e2e-pause-${suffix}` } },
  })
  await payload.delete({
    collection: 'programs',
    where: { slug: { equals: `e2e-pause-${suffix}` } },
    context,
  })
  await payload.delete({ collection: 'slot-types', where: { name: { like: suffix } }, context })
}

/** Starts the program so that today is program day `day` in Asia/Almaty. */
async function enrollAtDay(email: string, programId: number, day: number, extraDays = 0) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    depth: 0,
  })
  const enrollment = await payload.create({
    collection: 'enrollments',
    data: {
      student: docs[0]!.id,
      program: programId,
      placement: { test: 'murad', cefr: 'B1', takenAt: '2026-10-01T12:00:00.000Z' },
    } as never,
  })
  const startDate = addDays(todayIn(ZONE), -(day - 1 + extraDays))
  await payload.db.updateOne({
    collection: 'enrollments',
    id: enrollment.id,
    data: { status: 'active', timezone: ZONE, startDate: `${startDate}T00:00:00.000Z` },
  })
  return enrollment
}

async function studentSignsIn(page: Page, email: string) {
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

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

test.describe('Pause and resume (story 017)', () => {
  test('1/3/7. pause on day 10: «На паузе…», ‖ in the grid, no timer; then resume on day 10', async ({
    page,
  }, testInfo) => {
    const suffix = `pause-${testInfo.project.name}`
    const program = await seed(suffix)
    const email = await seedTestUser(suffix, 'student')
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    try {
      // Fifteen days since the start, five of them paused: back on program day 10.
      const enrollment = await enrollAtDay(email, program.id, 10)
      const payload = await getPayload({ config })
      await studentSignsIn(page, email)

      // A running program offers «Пауза» and the timer.
      await expect(page.getByRole('button', { name: 'Старт' })).toBeVisible()
      await page.getByRole('button', { name: 'Пауза', exact: true }).click()
      await expect(page.getByText('Поставить программу на паузу?')).toBeVisible()
      await page.getByRole('button', { name: 'Поставить на паузу' }).click()

      // AC 1: «На паузе с <date> · День 10 из 56» and «Продолжить»; the timer is gone (AC 7).
      const status = page.getByTestId('paused-status')
      await expect(status).toContainText(/На паузе с \d{1,2} [а-я]+ · День 10 из 56/)
      await expect(page.getByRole('button', { name: 'Продолжить' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Старт' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Пауза', exact: true })).toHaveCount(0)

      // AC 3: today's calendar day is marked ‖ with its state in words, and cannot be opened.
      const paused = page.getByRole('img', { name: /пауза/i })
      await expect(paused.first()).toBeVisible()
      await expect(paused.first()).toContainText('‖')
      expect(await noHorizontalScroll(page)).toBe(true)

      const stored = await payload.findByID({ collection: 'enrollments', id: enrollment.id })
      expect(stored.status).toBe('paused')
      expect(stored.pauses).toHaveLength(1)
      expect(stored.pauses?.[0]?.to ?? null).toBeNull()

      // The pause lasted five days: move its start and the program's start back five days.
      const from = addDays(todayIn(ZONE), -5)
      await payload.db.updateOne({
        collection: 'enrollments',
        id: enrollment.id,
        data: { startDate: `${addDays(todayIn(ZONE), -14)}T00:00:00.000Z` },
      })
      await payload.update({
        collection: 'enrollments',
        id: enrollment.id,
        data: { pauses: [{ from: `${from}T00:00:00.000Z`, to: null }] } as never,
        context,
      })
      await page.reload()
      await expect(page.getByTestId('paused-status')).toContainText('День 10 из 56')

      // AC 2: «Продолжить» ends the pause yesterday and today is day 10 again.
      await page.getByRole('button', { name: 'Продолжить' }).click()
      await expect(page.getByRole('heading', { name: /День 10 из 56/ })).toBeVisible()
      await expect(page.getByTestId('paused-status')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Старт' })).toBeVisible()
      await expect(page.getByRole('img', { name: /пауза/i })).toHaveCount(5)

      const resumed = await payload.findByID({ collection: 'enrollments', id: enrollment.id })
      expect(resumed.status).toBe('active')
      expect(resumed.pauses?.map((p) => [p.from.slice(0, 10), p.to?.slice(0, 10)])).toEqual([
        [from, addDays(todayIn(ZONE), -1)],
      ])
      expect(errors).toEqual([])
    } finally {
      await cleanupTestUser(suffix)
      await cleanup(suffix)
    }
  })

  test('4. a pause of 200 days resumes normally', async ({ page }, testInfo) => {
    const suffix = `pause200-${testInfo.project.name}`
    const program = await seed(suffix)
    const email = await seedTestUser(suffix, 'student')
    try {
      // Day 5 of an eight-week program, then paused for 200 days.
      const enrollment = await enrollAtDay(email, program.id, 5, 200)
      const payload = await getPayload({ config })
      await payload.update({
        collection: 'enrollments',
        id: enrollment.id,
        data: {
          pauses: [
            {
              from: `${addDays(todayIn(ZONE), -200)}T00:00:00.000Z`,
              to: `${addDays(todayIn(ZONE), -1)}T00:00:00.000Z`,
            },
          ],
        } as never,
        context,
      })
      await studentSignsIn(page, email)
      await expect(page.getByRole('heading', { name: /День 5 из 56/ })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Старт' })).toBeVisible()
      // A long pause is one wide cell, not a wall of ‖; the layout stays inside 360px.
      expect(await noHorizontalScroll(page)).toBe(true)
    } finally {
      await cleanupTestUser(suffix)
      await cleanup(suffix)
    }
  })

  test('6. pause and resume on the same day leave no pause', async ({ page }, testInfo) => {
    const suffix = `pause0-${testInfo.project.name}`
    const program = await seed(suffix)
    const email = await seedTestUser(suffix, 'student')
    try {
      const enrollment = await enrollAtDay(email, program.id, 10)
      await studentSignsIn(page, email)
      await page.getByRole('button', { name: 'Пауза', exact: true }).click()
      await page.getByRole('button', { name: 'Поставить на паузу' }).click()
      await page.getByRole('button', { name: 'Продолжить' }).click()
      await expect(page.getByRole('heading', { name: /День 10 из 56/ })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Старт' })).toBeVisible()

      const payload = await getPayload({ config })
      const stored = await payload.findByID({ collection: 'enrollments', id: enrollment.id })
      expect(stored.status).toBe('active')
      expect(stored.pauses ?? []).toEqual([])
    } finally {
      await cleanupTestUser(suffix)
      await cleanup(suffix)
    }
  })
})
