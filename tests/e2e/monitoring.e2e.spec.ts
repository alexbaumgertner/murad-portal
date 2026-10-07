import { expect, test } from '@playwright/test'

// The suite runs without SENTRY_DSN, like a fresh clone of the template.
test.describe('without SENTRY_DSN', () => {
  test('pages load no Sentry SDK and send nothing to Sentry', async ({ page }) => {
    const sentryRequests: string[] = []
    page.on('request', (request) => {
      if (/sentry|\/monitoring/i.test(request.url())) sentryRequests.push(request.url())
    })

    await page.goto('/')
    await page.goto('/changelog')
    await page.waitForLoadState('networkidle')

    expect(await page.evaluate(() => '__SENTRY__' in globalThis)).toBe(false)
    expect(sentryRequests).toEqual([])
  })

  test('there is no tunnel route', async ({ request }) => {
    const response = await request.post('/monitoring', { data: 'x' })
    expect(response.status()).toBe(404)
  })
})
