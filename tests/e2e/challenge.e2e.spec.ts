import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'
import config from '../../src/payload.config'
import { seedDemoChallenge } from '../../scripts/seed-challenge'
import en from '../../messages/en.json'
import ru from '../../messages/ru.json'

let payload: Payload
let slug: string
let id: number
const context = { disableRevalidate: true }
test.beforeAll(async ({}, info) => {
  payload = await getPayload({ config })
  slug = `tracker-${info.project.name}-${Date.now()}`
  id = (await seedDemoChallenge(payload, slug)).id
})
test.afterAll(async () => {
  if (id) {
    await payload.delete({
      collection: 'challenge-days',
      where: { challenge: { equals: id } },
      context,
    })
    await payload.delete({ collection: 'challenges', id, context })
  }
  // Playwright reuses this worker and Payload singleton for later files.
})
for (const locale of ['ru', 'en']) {
  test(`${locale}: blocks, states, details, summary and 360px targets`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto(`${locale === 'en' ? '/en' : ''}/challenge/${slug}`)
    await expect(page.locator('[data-day]')).toHaveCount(90)
    await expect(page.locator('[data-block]')).toHaveCount(6)
    const copy = locale === 'en' ? en.Challenge : ru.Challenge
    await expect(page.locator('[data-block] h2')).toHaveText(
      Array.from({ length: 6 }, (_, i) => copy.video.replace('{number}', String(i + 1))),
    )
    await expect(page.locator('[data-block] h3')).toHaveText(Array(6).fill(en.Challenge.demoTopic))
    for (const state of ['closed', 'today', 'missed', 'future']) {
      await expect(page.locator(`[data-state="${state}"]`).first()).toBeVisible()
    }
    await expect(page.getByRole('progressbar')).toHaveCount(3)
    await expect(page.locator('[data-rules]')).toBeVisible()
    await expect(page.getByRole('progressbar').first()).toHaveAttribute('value', '3')
    await expect(page.getByRole('link', { name: /YouTube/ })).toBeVisible()
    await page.locator('summary').first().click()
    await expect(page.locator('details').first()).toContainText('90')
    await expect(page.locator('details').first().locator('time')).toBeVisible()
    await expect(page.locator('details').first().locator('p').last()).not.toBeEmpty()
    expect(
      await page.locator('[data-day]').evaluateAll((cells) =>
        cells.every((cell) => {
          const target = cell.querySelector('summary') ?? cell
          const rect = target.getBoundingClientRect()
          return rect.width >= 32 && rect.height >= 32
        }),
      ),
    ).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
test('reload reflects closed days; empty rules and outside-calendar states', async ({ page }) => {
  await page.goto(`/challenge/${slug}`)
  await payload.create({
    collection: 'challenge-days',
    context,
    data: {
      challenge: id,
      dayNumber: 4,
      minutes: 120,
      closedAt: new Date().toISOString(),
      notes: 'Reload evidence',
    },
  })
  await page.reload()
  await expect(page.locator('[data-day="4"]')).toHaveAttribute('data-state', 'closed')
  await page.goto(`/en/challenge/${slug}`)
  await page.reload()
  await expect(page.locator('[data-day="4"]')).toHaveAttribute('data-state', 'closed')
  for (const [startDate, status] of [
    ['2099-01-01', 'not-started'],
    ['2000-01-01', 'finished'],
  ] as const) {
    await payload.update({
      collection: 'challenges',
      id,
      context,
      data: {
        startDate,
        rules:
          status === 'not-started'
            ? null
            : {
                root: {
                  type: 'root',
                  format: '',
                  indent: 0,
                  version: 1,
                  direction: 'ltr',
                  children: [
                    {
                      type: 'paragraph',
                      format: '',
                      indent: 0,
                      version: 1,
                      direction: 'ltr',
                      children: [],
                    },
                  ],
                },
              },
      },
    })
    await page.reload()
    await expect(page.locator('[data-countdown]')).toHaveAttribute('data-countdown', status)
    await expect(page.locator('[data-state="today"]')).toHaveCount(0)
    await expect(page.locator('[data-rules]')).toHaveCount(0)
  }
})
test('unknown and non-public slugs return HTTP 404 in both locales', async ({ page }) => {
  await payload.update({ collection: 'challenges', id, context, data: { isPublic: false } })
  for (const prefix of ['', '/en']) {
    for (const value of [slug, 'unknown-tracker']) {
      const response = await page.goto(`${prefix}/challenge/${value}`)
      expect(response?.status()).toBe(404)
    }
  }
})
