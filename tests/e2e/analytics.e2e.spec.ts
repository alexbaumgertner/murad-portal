import { expect, test } from '@playwright/test'

// The suite runs with the default ANALYTICS_PROVIDER=none.
test('without an analytics provider, pages load no tracker and send no events', async ({
  page,
}) => {
  const beacons: string[] = []
  page.on('request', (request) => {
    if (/_vercel\/insights|vercel-scripts\.com/.test(request.url())) beacons.push(request.url())
  })

  await page.goto('/')
  await page.goto('/changelog')
  await page.waitForLoadState('networkidle')

  expect(await page.evaluate(() => 'va' in window)).toBe(false)
  expect(beacons).toEqual([])
})
