import { expect, test, type Page } from '@playwright/test'

import { seedChangelogEntry } from '../helpers/seedChangelog'

const alternates = (page: Page) =>
  page
    .locator('link[rel="alternate"][hreflang]')
    .evaluateAll((links) =>
      links.map((link) => [
        link.getAttribute('hreflang'),
        new URL(link.getAttribute('href') ?? '').pathname,
      ]),
    )

for (const path of ['/', '/en', '/changelog', '/en/changelog']) {
  test(`${path} has canonical and Russian-default hreflang alternates`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator('html')).toHaveAttribute('lang', path.startsWith('/en') ? 'en' : 'ru')
    expect(new URL(page.url()).pathname).toBe(path)
    const russian = path.replace(/^\/en/, '') || '/'
    const english = `/en${russian === '/' ? '' : russian}`
    expect(await alternates(page)).toEqual([
      ['en', english],
      ['ru', russian],
      ['x-default', russian],
    ])
    const canonical = page.locator('link[rel="canonical"]')
    await expect(canonical).toHaveCount(1)
    expect(new URL((await canonical.getAttribute('href')) ?? '').href).toBe(
      new URL(path, process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').href,
    )
  })
}

test('the redundant Russian prefix redirects to the unprefixed URL', async ({ page }) => {
  await page.goto('/ru/changelog')
  expect(new URL(page.url()).pathname).toBe('/changelog')
})

test.describe('Russian', () => {
  test('shows translated changelog content and falls back to English', async ({
    page,
  }, testInfo) => {
    const id = `${testInfo.project.name}-${Date.now()}`
    const cleanups = [
      await seedChangelogEntry(
        { title: `Translated ${id}`, summary: 'English summary' },
        { title: `Переведено ${id}`, summary: 'Русское описание' },
      ),
      await seedChangelogEntry({ title: `English only ${id}`, summary: `Not translated ${id}` }),
    ]
    try {
      await page.goto('/changelog')
      await expect(page.getByRole('heading', { level: 1, name: 'Изменения' })).toBeVisible()
      await expect(page.getByRole('heading', { name: `Переведено ${id}` })).toBeVisible()
      await expect(page.getByRole('heading', { name: `English only ${id}` })).toBeVisible()
      await expect(page.getByText(`Not translated ${id}`)).toBeVisible()

      await page.goto('/en/changelog')
      await expect(page.getByRole('heading', { name: `Translated ${id}` })).toBeVisible()
      await expect(page.getByText('Русское описание')).toHaveCount(0)
    } finally {
      await Promise.all(cleanups.map((cleanup) => cleanup()))
    }
  })

  test('renders a Russian 404 for unknown pages', async ({ page }) => {
    const response = await page.goto('/no-such-page')

    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible()
  })
})

test.describe('language switcher', () => {
  for (const path of ['/', '/changelog']) {
    test(`switches ${path} in both directions and remembers the choice`, async ({ page }) => {
      await page.goto(path)
      await page.getByRole('group', { name: 'Язык' }).getByRole('link', { name: 'English' }).click()
      await expect(page).toHaveURL(`/en${path === '/' ? '' : path}`)
      await expect(page.locator('html')).toHaveAttribute('lang', 'en')
      await page.goto(path)
      await expect(page.locator('html')).toHaveAttribute('lang', 'en')
      await page
        .getByRole('group', { name: 'Language' })
        .getByRole('link', { name: 'Русский' })
        .click()
      await expect(page).toHaveURL(path)
      await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    })
  }
})

test.describe('locale negotiation', () => {
  for (const language of ['ru-RU', 'en-US', 'de-DE']) {
    test(`a ${language} browser without a locale cookie lands in Russian at /`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ locale: language })
      try {
        const page = await context.newPage()
        await page.goto('/')
        expect(new URL(page.url()).pathname).toBe('/')
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
      } finally {
        await context.close()
      }
    })
  }

  test('an unknown locale prefix is a 404, not a new language', async ({ page }) => {
    const response = await page.goto('/de/changelog')
    expect(response?.status()).toBe(404)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  })
})

test('the Payload admin and API stay outside locale routing', async ({ page, request }) => {
  await page.goto('/admin/login')
  expect(new URL(page.url()).pathname).toBe('/admin/login')
  expect((await request.get('/api/changelog?limit=1')).status()).toBe(200)
  expect((await request.get('/ru/admin', { maxRedirects: 0 })).status()).toBe(404)
})
