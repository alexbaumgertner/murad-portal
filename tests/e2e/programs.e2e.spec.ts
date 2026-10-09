import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

test.describe('Programs in the admin (story 009)', () => {
  test.describe.configure({ mode: 'serial' })

  let page: Page
  let typeName: string
  let slug: string

  test.beforeAll(async ({ browser }, testInfo) => {
    typeName = `Anki ${testInfo.project.name}`
    slug = `e2e-${testInfo.project.name}`
    const email = await seedTestUser(`programs-${testInfo.project.name}`)
    page = await (await browser.newContext()).newPage()
    await login({ page, email })
  })

  test.afterAll(async ({}, testInfo) => {
    const payload = await getPayload({ config })
    const context = { disableRevalidate: true }
    await payload.delete({ collection: 'programs', where: { slug: { equals: slug } }, context })
    await payload.delete({
      collection: 'slot-types',
      where: { name: { equals: typeName } },
      context,
    })
    await cleanupTestUser(`programs-${testInfo.project.name}`)
  })

  test('Murad creates a slot type and picks it in a program week template', async () => {
    await page.goto('/admin/collections/slot-types/create')
    await page.locator('input[name="name"]').fill(typeName)
    await expect(page.locator('input[name="defaultMinMinutes"]')).toHaveValue('20')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('successfully')).toBeVisible()

    await page.goto('/admin/collections/programs/create')
    await page.locator('input[name="title"]').fill('E2E program')
    await page.locator('input[name="slug"]').fill(slug)
    await expect(page.getByText('Day 01')).toBeVisible()
    await expect(page.getByText('Day 07')).toBeVisible()

    await page.getByRole('button', { name: 'Toggle block' }).first().click()
    await page.getByRole('button', { name: 'Add Slot' }).first().click()
    await page.locator('#field-weekTemplate__0__slots__0__slotType').click()
    await page.getByRole('option', { name: typeName }).click()
    await expect(page.getByText(typeName, { exact: true })).toBeVisible()

    // levels default to nothing, so choose a valid pair, then save a draft with the 7 template days
    for (const [field, level] of [
      ['levelFrom', 'A2'],
      ['levelTo', 'B1'],
    ] as const) {
      await page.locator(`#field-${field}`).click()
      await page.getByRole('option', { name: level, exact: true }).click()
    }
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).toHaveURL(/\/programs\/\d+$/)

    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'programs',
      where: { slug: { equals: slug } },
      depth: 0,
    })
    expect(docs[0]).toMatchObject({ status: 'draft', durationWeeks: 52 })
    expect(docs[0]?.weekTemplate).toHaveLength(7)
    expect(docs[0]?.weekTemplate?.[0]?.slots).toHaveLength(1)
    expect(docs[0]?.weekTemplate?.[3]?.slots ?? []).toHaveLength(0)
  })

  test('refuses a program whose start level is not below the target', async () => {
    await page.goto('/admin/collections/programs/create')
    await page.locator('input[name="title"]').fill('Bad levels')
    await page.locator('input[name="slug"]').fill(`${slug}-bad`)
    const pick = async (field: string, level: string) => {
      await page.locator(`#field-${field}`).click()
      await page.getByRole('option', { name: level, exact: true }).click()
    }
    await pick('levelFrom', 'B2')
    await pick('levelTo', 'B1')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(
      page.getByText('Начальный уровень должен быть ниже целевого').first(),
    ).toBeAttached()
    await expect(page).toHaveURL(/\/programs\/create/)
  })
})
