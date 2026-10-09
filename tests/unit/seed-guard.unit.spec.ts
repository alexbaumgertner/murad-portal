import { describe, expect, it } from 'vitest'

import { canSeedStudy } from '../../scripts/seed-guard'

describe('canSeedStudy', () => {
  it('allows a Vercel preview build', () => {
    expect(
      canSeedStudy({ VERCEL_ENV: 'preview', DATABASE_URL: 'postgres://u:p@ep-x.neon.tech/db' }),
    ).toBe(true)
  })

  it('allows a database on this machine', () => {
    expect(canSeedStudy({ DATABASE_URL: 'postgresql://app:app@127.0.0.1:5432/app' })).toBe(true)
    expect(canSeedStudy({ DATABASE_URL: 'postgresql://app:app@localhost:5432/app' })).toBe(true)
  })

  it('refuses production, development builds and remote databases', () => {
    expect(
      canSeedStudy({ VERCEL_ENV: 'production', DATABASE_URL: 'postgresql://app@127.0.0.1/app' }),
    ).toBe(false)
    expect(
      canSeedStudy({ VERCEL_ENV: 'development', DATABASE_URL: 'postgresql://app@127.0.0.1/app' }),
    ).toBe(false)
    expect(canSeedStudy({ DATABASE_URL: 'postgres://u:p@ep-x.neon.tech/db' })).toBe(false)
  })

  it('refuses a missing or malformed URL', () => {
    expect(canSeedStudy({})).toBe(false)
    expect(canSeedStudy({ DATABASE_URL: 'not a url' })).toBe(false)
  })
})
