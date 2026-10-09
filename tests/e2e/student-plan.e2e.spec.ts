import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { clearTestLoginCodes, E2E_CODE, issueKnownCode, login } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

const context = { disableRevalidate: true }
const emptyWeek = () => Array.from({ length: 7 }, () => ({ slots: [] }))

/** A B1 → B2 program whose default plan has 2 tasks in weeks 1–4 and none after. */
async function seedPlan(suffix: string) {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'programs',
    where: { slug: { equals: `e2e-splan-${suffix}` } },
    context,
  })
  await payload.delete({ collection: 'task-pool', where: { title: { like: suffix } }, context })
  const program = await payload.create({
    collection: 'programs',
    context,
    data: {
      slug: `e2e-splan-${suffix}`,
      title: `E2E plan ${suffix}`,
      levelFrom: 'B1',
      levelTo: 'B2',
      durationWeeks: 8,
      status: 'published',
      weekTemplate: emptyWeek(),
    } as never,
  })
  const review = await payload.create({
    collection: 'task-pool',
    context,
    data: {
      title: `Отзыв ${suffix}`,
      level: 'B1',
      text: { ru: `Напиши отзыв на серию ${suffix}` },
    },
  })
  const essay = await payload.create({
    collection: 'task-pool',
    context,
    data: { title: `Эссе ${suffix}`, level: 'B2', text: { ru: `Эссе о городе ${suffix}` } },
  })
  for (let week = 1; week <= 4; week += 1) {
    await payload.create({
      collection: 'program-plan-items',
      data: { program: program.id, week, day: 2, order: 1, task: review.id },
    })
    await payload.create({
      collection: 'program-plan-items',
      data: { program: program.id, week, day: 5, order: 1, task: essay.id },
    })
  }
  return { program, review, essay }
}

async function cleanupPlan(suffix: string) {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'enrollments',
    where: { 'program.slug': { equals: `e2e-splan-${suffix}` } },
  })
  await payload.delete({
    collection: 'program-plan-items',
    where: { 'program.slug': { equals: `e2e-splan-${suffix}` } },
  })
  await payload.delete({
    collection: 'programs',
    where: { slug: { equals: `e2e-splan-${suffix}` } },
    context,
  })
  await payload.delete({ collection: 'task-pool', where: { title: { like: suffix } }, context })
}

/** Assigns through the Local API (the admin form is covered by story 012's e2e). */
async function assign(studentEmail: string, programId: number) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: studentEmail } },
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
  return { studentId: docs[0]!.id, enrollment }
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

test.describe('Murad edits a student’s personal plan (story 018)', () => {
  test.describe.configure({ mode: 'serial' })

  let page: Page
  let suffix: string
  let studentEmail: string
  let studentId: number
  let seeded: Awaited<ReturnType<typeof seedPlan>>

  test.beforeAll(async ({ browser }, testInfo) => {
    suffix = `splan-admin-${testInfo.project.name}`
    seeded = await seedPlan(suffix)
    studentEmail = await seedTestUser(`${suffix}-student`, 'student')
    const email = await seedTestUser(suffix)
    page = await (await browser.newContext()).newPage()
    await login({ page, email })
  })

  test.afterAll(async () => {
    await cleanupTestUser(`${suffix}-student`)
    await cleanupTestUser(suffix)
    await cleanupPlan(suffix)
  })

  test('1. assigning copies all 8 plan items into her plan', async () => {
    const assigned = await assign(studentEmail, seeded.program.id)
    studentId = assigned.studentId
    const payload = await getPayload({ config })
    const { totalDocs } = await payload.count({
      collection: 'student-assignments',
      where: { enrollment: { equals: assigned.enrollment.id } },
    })
    expect(totalDocs).toBe(8)
  })

  test('2/3. «План ученика» shows the grid; a custom text turns a task into «своё»', async () => {
    await page.goto(`/admin/collections/users/${studentId}`)
    const grid = page.getByRole('table', { name: 'План ученика' })
    await grid.scrollIntoViewIfNeeded()
    await expect(grid).toBeVisible()
    const week3 = grid.getByRole('row', { name: /Неделя 3/ })
    await expect(week3).toContainText(`Напиши отзыв на серию ${suffix}`)
    await expect(week3).toContainText(`Эссе о городе ${suffix}`)
    await expect(grid.getByText('из пула').first()).toBeVisible()
    await expect(grid.getByText('своё')).toHaveCount(0)

    await week3.getByRole('link', { name: new RegExp(`Напиши отзыв на серию ${suffix}`) }).click()
    await expect(page).toHaveURL(/\/student-assignments\/\d+$/)
    const id = Number(page.url().split('/').pop())
    await page.locator('textarea[name="text.ru"]').fill('Посмотри серию с Мурадом')
    const saved = page.waitForResponse(
      (r) => r.request().method() === 'PATCH' && r.url().includes(`/api/student-assignments/${id}`),
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    expect((await saved).status()).toBe(200)
    const payload = await getPayload({ config })
    expect(
      await payload.findByID({ collection: 'student-assignments', id, depth: 0 }),
    ).toMatchObject({
      text: { ru: 'Посмотри серию с Мурадом' },
      sourceTask: null,
      editedByOwner: true,
    })

    await page.goto(`/admin/collections/users/${studentId}`)
    const row = page.getByRole('table', { name: 'План ученика' }).getByRole('row', {
      name: /Неделя 3/,
    })
    await row.scrollIntoViewIfNeeded()
    await expect(row).toContainText('Посмотри серию с Мурадом')
    await expect(row.getByText('своё')).toBeVisible()
  })
})

test.describe('The student sees all weeks of her plan (story 018)', () => {
  test('4/7. opens a future week read-only; an empty week says so', async ({ page }, testInfo) => {
    const suffix = `splan-student-${testInfo.project.name}`
    const seeded = await seedPlan(suffix)
    const email = await seedTestUser(suffix, 'student')
    try {
      const { enrollment } = await assign(email, seeded.program.id)
      // Day 10: she started nine days ago.
      const payload = await getPayload({ config })
      const start = new Date(Date.now() - 9 * 86_400_000).toISOString().slice(0, 10)
      await payload.db.updateOne({
        collection: 'enrollments',
        id: enrollment.id,
        data: { status: 'active', timezone: 'Asia/Almaty', startDate: `${start}T00:00:00.000Z` },
      })

      await studentSignsIn(page, email)
      await page.getByRole('link', { name: 'Все недели' }).click()
      await expect(page.getByRole('heading', { name: 'Неделя 2' })).toBeVisible()
      await expect(page.getByRole('link', { name: /Неделя 2/ })).toHaveAttribute(
        'aria-current',
        'page',
      )

      await page.getByRole('link', { name: 'Неделя 3', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Неделя 3' })).toBeVisible()
      await expect(page.getByText(`Напиши отзыв на серию ${suffix}`)).toBeVisible()
      await expect(page.getByText(`Эссе о городе ${suffix}`)).toBeVisible()
      await expect(page.getByRole('button', { name: /Изменить|Удалить/ })).toHaveCount(0)

      await page.getByRole('link', { name: 'Неделя 6', exact: true }).click()
      await expect(page.getByText('На этой неделе заданий нет')).toBeVisible()

      await page.setViewportSize({ width: 360, height: 740 })
      const width = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(width).toBeLessThanOrEqual(360)
    } finally {
      await cleanupTestUser(suffix)
      await cleanupPlan(suffix)
    }
  })
})
