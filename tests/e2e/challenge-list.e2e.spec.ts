import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'
import config from '../../src/payload.config'
import { seedDemoChallenge } from '../../scripts/seed-challenge'
import en from '../../messages/en.json'
import ru from '../../messages/ru.json'

let payload: Payload
const ids: number[] = []
const context = { disableRevalidate: true }
let slugs: string[]
let privateSlug: string

test.beforeAll(async ({}, info) => {
  payload = await getPayload({ config })
  const base = `list-${info.project.name}-${Date.now()}`
  slugs = [`${base}-a`, `${base}-b`]
  privateSlug = `${base}-private`
  for (const slug of slugs) ids.push((await seedDemoChallenge(payload, slug)).id)
  const hidden = await seedDemoChallenge(payload, privateSlug)
  await payload.update({
    collection: 'challenges',
    id: hidden.id,
    data: { isPublic: false },
    context,
  })
  ids.push(hidden.id)
})
test.afterAll(async () => {
  for (const id of ids) {
    await payload.delete({
      collection: 'challenge-days',
      where: { challenge: { equals: id } },
      context,
    })
    await payload.delete({ collection: 'challenges', id, context })
  }
})

for (const locale of ['ru', 'en'] as const) {
  test(`${locale}: cards for public challenges only, 360px`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto(`${locale === 'en' ? '/en' : ''}/challenge`)
    const copy = locale === 'en' ? en.Challenge : ru.Challenge
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.listTitle)
    for (const slug of slugs) {
      const card = page.locator(`[data-challenge="${slug}"]`)
      await expect(card).toBeVisible()
      await expect(card.getByRole('link')).toHaveAttribute(
        'href',
        new RegExp(`/challenge/${slug}$`),
      )
      await expect(card).toContainText('/ 8')
    }
    await expect(page.locator(`[data-challenge="${privateSlug}"]`)).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.locator(`[data-challenge="${slugs[0]}"] a`).click()
    await expect(page.locator('[data-day]')).toHaveCount(90)
  })
}
