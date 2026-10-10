import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

// Payload's "Force Unlock" always answers 403 without passwords; "Reset login limits" replaces it.
test('Murad resets a student’s login limits from her user page', async ({ browser }, testInfo) => {
  const suffix = `unblock-${testInfo.project.name}`
  const studentEmail = await seedTestUser(`${suffix}-student`, 'student')
  const ownerEmail = await seedTestUser(suffix)
  const payload = await getPayload({ config })
  const where = { email: { equals: studentEmail } }

  try {
    const { docs } = await payload.find({ collection: 'users', where, limit: 1 })
    const studentId = docs[0]!.id
    for (let i = 0; i < 3; i += 1) {
      await payload.create({
        collection: 'auth-codes',
        data: {
          email: studentEmail,
          codeHash: 'f'.repeat(64),
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
          requestIp: `e2e:${studentEmail}`,
          delivered: true,
        },
      })
    }
    expect((await payload.count({ collection: 'auth-codes', where })).totalDocs).toBe(3)

    const page = await (await browser.newContext()).newPage()
    await login({ page, email: ownerEmail })
    await page.goto(`/admin/collections/users/${studentId}`)

    await expect(page.getByRole('button', { name: 'Force Unlock' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Reset login limits' }).click()
    await expect(page.getByText('Done. The user can request a new code now.')).toBeVisible()
    expect((await payload.count({ collection: 'auth-codes', where })).totalDocs).toBe(0)
  } finally {
    await payload.delete({ collection: 'auth-codes', where })
    await cleanupTestUser(`${suffix}-student`)
    await cleanupTestUser(suffix)
  }
})
