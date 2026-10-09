import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

test.describe('Task pool and default plan in the admin (story 010)', () => {
  test.describe.configure({ mode: 'serial' })

  let page: Page
  let slug: string
  let programId: number
  const context = { disableRevalidate: true }
  const emptyWeek = () => Array.from({ length: 7 }, () => ({ slots: [] }))

  test.beforeAll(async ({ browser }, testInfo) => {
    const suffix = `pool-${testInfo.project.name}`
    slug = `plan-e2e-${testInfo.project.name}`
    const email = await seedTestUser(suffix)
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'programs', where: { slug: { equals: slug } }, context })
    const program = await payload.create({
      collection: 'programs',
      context,
      data: {
        slug,
        title: `Plan ${testInfo.project.name}`,
        levelFrom: 'B1',
        levelTo: 'B2',
        weekTemplate: emptyWeek(),
      } as never,
    })
    programId = program.id as number
    page = await (await browser.newContext()).newPage()
    await login({ page, email })
  })

  test.afterAll(async ({}, testInfo) => {
    const payload = await getPayload({ config })
    await payload.delete({
      collection: 'program-plan-items',
      where: { program: { equals: programId } },
      context,
    })
    await payload.delete({
      collection: 'task-pool',
      where: { title: { like: `E2E ${testInfo.project.name}` } },
      context,
    })
    await payload.delete({ collection: 'programs', where: { slug: { equals: slug } }, context })
    await cleanupTestUser(`pool-${testInfo.project.name}`)
  })

  test('Murad writes a B1 task and finds it in the pool list', async ({}, testInfo) => {
    const title = `E2E ${testInfo.project.name} Отзыв на серию`
    await page.goto('/admin/collections/task-pool/create')
    await page.locator('input[name="title"]').fill(title)
    await page.locator('#field-level').click()
    await page.getByRole('option', { name: 'B1', exact: true }).click()
    await page
      .locator('textarea[name="text.ru"]')
      .fill('Напиши отзыв на любую серию (200 слов) и будь готов обсудить')
    await expect(page.getByText('Изменения попадут только в новые планы')).toBeVisible()
    await expect(async () => {
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page).toHaveURL(/\/task-pool\/\d+$/, { timeout: 3_000 })
    }).toPass({ timeout: 30_000 })

    await page.goto('/admin/collections/task-pool')
    await expect(page.getByText(title).first()).toBeVisible()
  })

  test('the plan grid shows week × day and copies week 1 into weeks 2–3', async ({}, testInfo) => {
    const payload = await getPayload({ config })
    const task = await payload.create({
      collection: 'task-pool',
      context,
      data: {
        title: `E2E ${testInfo.project.name} grid`,
        level: 'B1',
        text: { ru: 'Задание' },
      } as never,
    })
    for (const [day, order] of [
      [1, 1],
      [1, 2],
      [5, 1],
    ]) {
      await payload.create({
        collection: 'program-plan-items',
        context,
        data: { program: programId, task: task.id, week: 1, day, order } as never,
      })
    }

    await page.goto(`/admin/collections/program-plan-items?program=${programId}`)
    const grid = page.getByRole('table', { name: 'План по умолчанию' })
    await expect(grid).toBeVisible()
    await expect(grid.getByRole('columnheader', { name: 'День 5' })).toBeVisible()
    await expect(grid.getByRole('row', { name: /^Неделя 1\b/ })).toContainText(
      `E2E ${testInfo.project.name} grid`,
    )

    await page.getByLabel('Копировать неделю').fill('1')
    await page.getByLabel('в недели с').fill('2')
    await page.getByLabel('по', { exact: true }).fill('3')
    await page.getByRole('button', { name: 'Копировать', exact: true }).click()
    await expect(page.getByText('Скопировано: 6, пропущено (занято): 0')).toBeVisible()

    const { totalDocs } = await payload.count({
      collection: 'program-plan-items',
      where: { program: { equals: programId } },
    })
    expect(totalDocs).toBe(9)
  })
})
