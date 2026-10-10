import { expect, test } from '@playwright/test'

import { siteConfig } from '../../src/config/site'
import en from '../../messages/en.json'
import ru from '../../messages/ru.json'

for (const [path, messages] of [
  ['/', ru],
  ['/en', en],
] as const) {
  test(`${path} shows the landing, a sign-in link and no admin link`, async ({ page }) => {
    await page.goto(path)
    const prefix = path === '/' ? '' : path
    await expect(page.getByRole('banner')).toContainText(siteConfig.name)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages.Home.hero.title)
    const nav = page.getByRole('banner').getByRole('navigation')
    await expect(nav.getByRole('link', { name: messages.Header.signIn })).toHaveAttribute(
      'href',
      `${prefix}/login`,
    )
    await expect(page.locator('a[href="/admin"]')).toHaveCount(0)
    await expect(
      page.getByRole('main').getByRole('link', { name: messages.Home.hero.cta }).first(),
    ).toHaveAttribute('href', siteConfig.telegramUrl)
    for (const id of ['about', 'approach', 'materials', 'audience', 'faq', 'contact']) {
      await expect(page.locator(`#${id}`)).toBeVisible()
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
