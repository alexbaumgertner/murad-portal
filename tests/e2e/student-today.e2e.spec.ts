import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import { dateOfDay } from '../../src/features/study-today/shape'
import { todayIn } from '../../src/features/enrollments/shape'
import config from '../../src/payload.config'
import { clearTestLoginCodes, E2E_CODE, issueKnownCode } from '../helpers/login'
import { cleanupTestUser, seedTestUser, setAddressForm } from '../helpers/seedUser'

const context = { disableRevalidate: true }

/** Template day 3 = [Anki 20, Сериал 40]; day 4 and the rest are rest days. */
async function seed(suffix: string, durationWeeks = 8) {
  const payload = await getPayload({ config })
  await cleanup(suffix)
  const anki = await payload.create({
    collection: 'slot-types',
    context,
    data: { name: `Anki ${suffix}`, description: `Карточки ${suffix}`, defaultMinMinutes: 20 },
  })
  const series = await payload.create({
    collection: 'slot-types',
    context,
    data: { name: `Сериал ${suffix}`, defaultMinMinutes: 30 },
  })
  const day = (slots: object[]) => ({ slots })
  const program = await payload.create({
    collection: 'programs',
    context,
    data: {
      slug: `e2e-today-${suffix}`,
      title: `E2E сегодня ${suffix}`,
      levelFrom: 'B1',
      levelTo: 'B2',
      durationWeeks,
      status: 'published',
      weekTemplate: [
        day([]),
        day([]),
        day([{ slotType: anki.id }, { slotType: series.id, minMinutes: 40 }]),
        day([]),
        day([]),
        day([]),
        day([]),
      ],
    } as never,
  })
  const task = await payload.create({
    collection: 'task-pool',
    context,
    data: { title: `Отзыв ${suffix}`, level: 'B1', text: { ru: `Напиши отзыв ${suffix}` } },
  })
  const essay = await payload.create({
    collection: 'task-pool',
    context,
    data: { title: `Эссе ${suffix}`, level: 'B1', text: { ru: `Эссе о городе ${suffix}` } },
  })
  for (const [order, pooled] of durationWeeks >= 2 ? [task, essay].entries() : []) {
    await payload.create({
      collection: 'program-plan-items',
      data: { program: program.id, week: 2, day: 3, order: order + 1, task: pooled.id },
    })
  }
  return program
}

async function cleanup(suffix: string) {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'enrollments',
    where: { 'program.slug': { equals: `e2e-today-${suffix}` } },
  })
  await payload.delete({
    collection: 'program-plan-items',
    where: { 'program.slug': { equals: `e2e-today-${suffix}` } },
  })
  await payload.delete({
    collection: 'programs',
    where: { slug: { equals: `e2e-today-${suffix}` } },
    context,
  })
  await payload.delete({ collection: 'task-pool', where: { title: { like: suffix } }, context })
  await payload.delete({ collection: 'slot-types', where: { name: { like: suffix } }, context })
}

/** Assigns and starts so that today is program day `day` in Asia/Almaty. */
async function enrollAtDay(email: string, programId: number, day: number) {
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
  const start = dateOfDay(todayIn('Asia/Almaty'), 2 - day) // day 1 is `day - 1` days ago
  await payload.db.updateOne({
    collection: 'enrollments',
    id: enrollment.id,
    data: { status: 'active', timezone: 'Asia/Almaty', startDate: `${start}T00:00:00.000Z` },
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

async function noHorizontalScroll(page: Page) {
  await page.setViewportSize({ width: 360, height: 740 })
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(360)
}

test.describe('The student opens «Сегодня» (story 013)', () => {
  test('1–4/6/10. day 10: header, slots, tasks, the week grid, a past day, «вы»', async ({
    page,
  }, testInfo) => {
    const suffix = `today-${testInfo.project.name}`
    const program = await seed(suffix)
    const email = await seedTestUser(suffix, 'student')
    try {
      await enrollAtDay(email, program.id, 10)
      await setAddressForm(email, 'vy')
      await studentSignsIn(page, email)

      // 1. header
      await expect(page.getByRole('heading', { name: 'День 10 из 56 · Неделя 2' })).toBeVisible()
      await expect(page.getByText(`E2E сегодня ${suffix}`)).toBeVisible()
      await expect(page.getByTestId('stat-done')).toHaveText('0')
      await expect(page.getByTestId('stat-missed')).toHaveText('1') // day 3 of week 1
      await expect(page.getByTestId('stat-minutes')).toHaveText('0')

      // 2. today's slots and tasks
      const today = page.getByRole('region', { name: 'Сегодня' })
      await expect(today.getByText(`Anki ${suffix}`)).toBeVisible()
      await expect(today.getByText('мин. 20 мин')).toBeVisible()
      await expect(today.getByText('мин. 40 мин')).toBeVisible()
      await expect(today.getByText(`Карточки ${suffix}`)).toBeVisible()
      await expect(today.getByText(`Напиши отзыв ${suffix}`)).toBeVisible()
      await expect(today.getByText(`Эссе о городе ${suffix}`)).toBeVisible()

      // 3. the grid: 7 cells, today outlined and named, a missed day carries ✕
      const cells = page.getByRole('list', { name: 'Дни недели 2' }).getByRole('link')
      await expect(cells).toHaveCount(7)
      await expect(cells.nth(2)).toHaveAccessibleName(/День 10, .*: Сегодня/)
      await expect(cells.nth(2)).toHaveAttribute('aria-current', 'date')
      await expect(cells.nth(0)).toHaveAccessibleName(/День 8, .*: День отдыха/)
      await expect(cells.nth(3)).toContainText('—')

      // 6. «вы»
      await expect(page.getByText('Нажмите на день, чтобы посмотреть')).toBeVisible()

      // 4. a past day, read-only: day 3 was a training day of week 1
      await page.goto('/study?day=9')
      await expect(page.getByRole('heading', { name: /^День 9 · / })).toBeVisible()
      await page.goto('/study')

      // 10. 360 px
      await noHorizontalScroll(page)
      for (const cell of await cells.all()) {
        const box = (await cell.boundingBox())!
        expect(box.width).toBeGreaterThanOrEqual(32)
        expect(box.height).toBeGreaterThanOrEqual(32)
      }
    } finally {
      await cleanupTestUser(suffix)
      await cleanup(suffix)
    }
  })

  test('4/5. tapping a day of the week opens it; «Все недели» lists weeks and a future week', async ({
    page,
  }, testInfo) => {
    const suffix = `today-weeks-${testInfo.project.name}`
    const program = await seed(suffix)
    const email = await seedTestUser(suffix, 'student')
    try {
      await enrollAtDay(email, program.id, 10)
      await studentSignsIn(page, email)

      await page.getByRole('list', { name: 'Дни недели 2' }).getByRole('link').nth(1).click()
      await expect(page).toHaveURL(/\/study\?day=9$/)
      await expect(page.getByRole('heading', { name: /^День 9 · / })).toBeVisible()
      await expect(page.getByText('День отдыха', { exact: true }).first()).toBeVisible()
      await page.getByRole('link', { name: '← К «Сегодня»' }).click()
      await expect(page.getByRole('heading', { name: 'Сегодня', exact: true })).toBeVisible()

      await page.getByRole('link', { name: 'Все недели' }).click()
      await expect(page.getByRole('link', { name: /Неделя 1, выполнено 0 из 1/ })).toBeVisible()
      await expect(page.getByRole('link', { name: /Неделя 2 \(сейчас\)/ })).toHaveAttribute(
        'aria-current',
        'page',
      )
      await page.getByRole('link', { name: 'Неделя 3', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Неделя 3' })).toBeVisible()
      await expect(page.getByText(`Anki ${suffix}`)).toBeVisible()
      await expect(page.getByRole('button', { name: /Изменить|Удалить|Отметить/ })).toHaveCount(0)
      await noHorizontalScroll(page)
    } finally {
      await cleanupTestUser(suffix)
      await cleanup(suffix)
    }
  })

  test('7. a rest day says «Сегодня отдых»', async ({ page }, testInfo) => {
    const suffix = `today-rest-${testInfo.project.name}`
    const program = await seed(suffix)
    const email = await seedTestUser(suffix, 'student')
    try {
      await enrollAtDay(email, program.id, 11) // template day 4
      await studentSignsIn(page, email)
      await expect(page.getByText('Сегодня отдых')).toBeVisible()
    } finally {
      await cleanupTestUser(suffix)
      await cleanup(suffix)
    }
  })

  test('8. past the last day: «Программа пройдена» with totals, status finished', async ({
    page,
  }, testInfo) => {
    const suffix = `today-done-${testInfo.project.name}`
    const program = await seed(suffix, 1)
    const email = await seedTestUser(suffix, 'student')
    try {
      const enrollment = await enrollAtDay(email, program.id, 20)
      await studentSignsIn(page, email)
      await expect(page.getByRole('heading', { name: 'Программа пройдена' })).toBeVisible()
      await expect(page.getByTestId('stat-done')).toHaveText('0')
      await expect(page.getByTestId('stat-missed')).toHaveText('1')
      const payload = await getPayload({ config })
      expect(
        (await payload.findByID({ collection: 'enrollments', id: enrollment.id })).status,
      ).toBe('finished')
      await page.reload()
      await expect(page.getByRole('heading', { name: 'Программа пройдена' })).toBeVisible()
    } finally {
      await cleanupTestUser(suffix)
      await cleanup(suffix)
    }
  })
})
