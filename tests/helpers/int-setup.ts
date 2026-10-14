import { config } from 'dotenv'

// dotenv never overrides an already-set variable, so the first file wins.
config({ path: ['.env.test.local', '.env'], quiet: true })

// Tests must never send real email: codes are printed to the console when no key is set.
delete process.env.RESEND_API_KEY

// Integration tests must never touch the dev or production database.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://app:app@127.0.0.1:5433/app_test'
