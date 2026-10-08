import { expect, test, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import { seedDemoChallenge } from '../../scripts/seed-challenge'
import en from '../../messages/en.json'
import config from '../../src/payload.config'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

const copy = en.Challenge.closeDay
const context = { disableRevalidate: true }
let payload: Payload
let slug: string
let challengeId: number
let suffix: string
let email: string

const days = async () =>
  (
    await payload.find({
      collection: 'challenge-days',
      where: { challenge: { equals: challengeId } },
      sort: 'dayNumber',
      depth: 0,
    })
  ).docs

test.beforeAll(async ({}, info) => {
  payload = await getPayload({ config })
  suffix = `close-day-${info.project.name}`
  slug = `close-day-${info.project.name}-${Date.now()}`
  challengeId = (await seedDemoChallenge(payload, slug)).id
  // The demo seed is a public challenge that started 15 days ago: today is day 16.
  email = await seedTestUser(suffix)
})

test.afterAll(async () => {
  await payload.delete({
    collection: 'challenge-days',
    where: { challenge: { equals: challengeId } },
    context,
  })
  await payload.delete({ collection: 'challenges', id: challengeId, context })
  await cleanupTestUser(suffix)
})

test.beforeEach(async () => {
  await payload.delete({
    collection: 'challenge-days',
    where: { challenge: { equals: challengeId } },
    context,
  })
})

/** Every actionable cell holds its own (hidden) form, so scope all form locators to one day. */
const dayCell = (page: Page, dayNumber: number) => page.locator(`[data-day="${dayNumber}"]`)

async function openDay(page: Page, dayNumber: number) {
  await dayCell(page, dayNumber).locator('summary').click()
}

test('a visitor sees read-only cells and no form (criterion 7)', async ({ page }) => {
  await page.goto(`/en/challenge/${slug}`)
  await expect(page.locator('[data-day]')).toHaveCount(90)
  await expect(page.locator('form')).toHaveCount(0)
  await expect(page.getByRole('button', { name: copy.submit })).toHaveCount(0)
})

test('Murad closes today in a few taps and sees progress change (criteria 1, 2, 9)', async ({
  page,
}) => {
  await login({ page, email })
  await page.goto(`/en/challenge/${slug}`)
  await expect(page.locator('[data-day="16"]')).toHaveAttribute('data-state', 'today')

  await openDay(page, 16)
  await expect(dayCell(page, 16).getByLabel(copy.minutesLabel)).toHaveValue('90')
  await dayCell(page, 16).getByLabel(copy.notesLabel).fill('Recorded the intro')
  await dayCell(page, 16).getByRole('button', { name: copy.submit }).click()

  await expect(page.locator('[data-day="16"]')).toHaveAttribute('data-state', 'closed')
  await expect(dayCell(page, 16).getByLabel(copy.minutesLabel)).toBeHidden()
  expect((await days()).map((d) => [d.dayNumber, d.minutes, d.notes])).toEqual([
    [16, 90, 'Recorded the intro'],
  ])
  await page.reload()
  await expect(page.locator('[data-day="16"]')).toHaveAttribute('data-state', 'closed')
})

test('a forgotten past day can be backfilled, and a second save updates it (criteria 3, 4)', async ({
  page,
}) => {
  await login({ page, email })
  await page.goto(`/en/challenge/${slug}`)
  await expect(page.locator('[data-day="3"]')).toHaveAttribute('data-state', 'missed')

  await openDay(page, 3)
  await dayCell(page, 3).getByLabel(copy.minutesLabel).fill('45')
  await dayCell(page, 3).getByRole('button', { name: copy.submit }).click()
  await expect(page.locator('[data-day="3"]')).toHaveAttribute('data-state', 'closed')

  await openDay(page, 3)
  await dayCell(page, 3).getByLabel(copy.minutesLabel).fill('75')
  await dayCell(page, 3).getByRole('button', { name: copy.update }).click()
  await expect(dayCell(page, 3).getByLabel(copy.minutesLabel)).toBeHidden()

  expect((await days()).map((d) => [d.dayNumber, d.minutes])).toEqual([[3, 75]])
})

test('invalid minutes and long notes show a translated message and save nothing (criterion 6)', async ({
  page,
}) => {
  await login({ page, email })
  await page.goto(`/en/challenge/${slug}`)
  await openDay(page, 16)

  await dayCell(page, 16).getByLabel(copy.minutesLabel).fill('601')
  await dayCell(page, 16).getByRole('button', { name: copy.submit }).click()
  await expect(dayCell(page, 16).getByRole('alert')).toHaveText(copy.errors.invalid_minutes)

  await dayCell(page, 16).getByLabel(copy.minutesLabel).fill('90')
  await dayCell(page, 16).getByLabel(copy.notesLabel).fill('x'.repeat(501))
  await dayCell(page, 16).getByRole('button', { name: copy.submit }).click()
  await expect(dayCell(page, 16).getByRole('alert')).toHaveText(copy.errors.invalid_notes)

  expect(await days()).toEqual([])
})

test('future cells are not actionable (criterion 5)', async ({ page }) => {
  await login({ page, email })
  await page.goto(`/en/challenge/${slug}`)
  await expect(page.locator('[data-day="17"]')).toHaveAttribute('data-state', 'future')
  await expect(page.locator('[data-day="17"] summary')).toHaveCount(0)
  await expect(page.locator('[data-day="17"] form')).toHaveCount(0)
})

test('the form fits a 360px screen (criterion 1)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await login({ page, email })
  await page.goto(`/challenge/${slug}`)
  await openDay(page, 16)
  await expect(page.getByRole('button').last()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
