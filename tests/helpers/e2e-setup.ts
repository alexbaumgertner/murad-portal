import { getPayload } from 'payload'
import config from '../../src/payload.config'
import { seedDemoChallenge } from '../../scripts/seed-challenge'

/** The web server has pushed the dev schema before Playwright calls global setup. */
export default async function setup() {
  const payload = await getPayload({ config })
  try {
    await seedDemoChallenge(payload)
  } finally {
    await payload.destroy()
  }
}
