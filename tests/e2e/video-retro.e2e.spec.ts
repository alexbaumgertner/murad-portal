import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'
import config from '../../src/payload.config'
import { seedDemoChallenge } from '../../scripts/seed-challenge'
import en from '../../messages/en.json'
import ru from '../../messages/ru.json'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'
let payload: Payload
let id: number
let slug: string
let email: string
let suffix: string
const context = { disableRevalidate: true }
test.beforeAll(async ({}, info) => {
  payload = await getPayload({ config })
  suffix = `video-retro-${info.project.name}`
  slug = `${suffix}-${Date.now()}`
  id = (await seedDemoChallenge(payload, slug)).id
  email = await seedTestUser(suffix)
})
test.afterAll(async () => {
  await payload.delete({
    collection: 'challenge-days',
    where: { challenge: { equals: id } },
    context,
  })
  await payload.delete({ collection: 'challenges', id, context })
  await cleanupTestUser(suffix)
})
for (const locale of ['en', 'ru'] as const) {
  test(`${locale}: saves a retro, validates, and shows it to visitors at 360px (criteria 1–5)`, async ({
    page,
  }) => {
    const copy = (locale === 'en' ? en : ru).Challenge.videoRetro
    const url = `${locale === 'en' ? '/en' : ''}/challenge/${slug}`
    await page.setViewportSize({ width: 360, height: 800 })
    await login({ page, email })
    await page.goto(url)
    const block = page.locator('[data-block="2"]')
    await block.getByText(copy.edit, { exact: true }).click()
    await block.getByLabel(copy.youtubeUrl).fill('javascript:alert(1)')
    await block.getByLabel(copy.publishedAt).fill('2099-01-01')
    await block.getByLabel(copy.retroWorked).fill('Good intro')
    await block.getByLabel(copy.retroDropped).fill('Long pause')
    await block.getByLabel(copy.retroChange).fill('Shorter intro')
    await block.getByRole('button', { name: copy.submit }).click()
    await expect(block.getByRole('alert')).toHaveText(copy.errors.invalid_url)
    await expect(block.getByLabel(copy.retroWorked)).toHaveValue('Good intro')
    await block.getByLabel(copy.youtubeUrl).fill('https://youtube.com/shorts/abcdefghijk')
    await block.getByLabel(copy.retroChange).fill('x'.repeat(401))
    await block.getByRole('button', { name: copy.submit }).click()
    await expect(block.getByRole('alert')).toHaveText(copy.errors.invalid_retro)
    await block.getByLabel(copy.retroChange).fill('Shorter intro')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await block.getByRole('button', { name: copy.submit }).click()
    await expect(block.getByLabel(copy.youtubeUrl)).toBeHidden()
    await expect(page.getByRole('progressbar').nth(1)).toHaveAttribute('value', '33')
    await page.context().clearCookies()
    await page.goto(url)
    await expect(block.getByRole('link')).toHaveAttribute(
      'href',
      'https://youtube.com/shorts/abcdefghijk',
    )
    await expect(block).toContainText('Good intro')
    await expect(block).toContainText('Long pause')
    await expect(block).toContainText('Shorter intro')
    await expect(block.locator('form')).toHaveCount(0)
  })
}
