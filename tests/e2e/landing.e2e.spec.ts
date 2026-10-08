import { expect, test } from '@playwright/test'

import { siteConfig } from '../../src/config/site'
import en from '../../messages/en.json'
import ru from '../../messages/ru.json'

for (const [path, messages] of [
  ['/', ru],
  ['/en', en],
] as const) {
  test(`${path} shows Murad, the challenge and four upcoming tools`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('banner')).toContainText(siteConfig.name)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages.Home.title)
    await expect(
      page.getByRole('main').getByRole('link', { name: messages.Home.challenge }),
    ).toHaveAttribute('href', path === '/' ? '/challenge' : '/en/challenge')
    const tools = page.getByRole('region', { name: messages.Home.toolsTitle })
    await expect(tools.getByRole('listitem')).toHaveCount(4)
    for (const tool of Object.values(messages.Home.tools)) {
      await expect(tools.getByRole('heading', { name: tool.title })).toBeVisible()
    }
  })

  test(`${path} hides the waitlist form`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator('form')).toHaveCount(0)
    await expect(page.getByPlaceholder('you@company.com')).toHaveCount(0)
  })

  test(`${path} fits a 360px viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto(path)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  })
}

test('changelog page renders', async ({ page }) => {
  await page.goto('/changelog')
  await expect(page.getByRole('heading', { level: 1, name: 'Изменения' })).toBeVisible()
})
