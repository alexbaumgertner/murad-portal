import { describe, expect, it } from 'vitest'

import {
  avatarError,
  formatStartDate,
  initialsOf,
  MAX_AVATAR_BYTES,
  sniffImageType,
} from '@/features/students/shape'

describe('initialsOf (story 021, AC 4)', () => {
  it('takes the first letters of the first two words of the name', () => {
    expect(initialsOf('anna petrova', 'a@example.com')).toBe('AP')
    expect(initialsOf('  Борис  ', 'b@example.com')).toBe('Б')
    expect(initialsOf('Ann Marie Lee', 'a@example.com')).toBe('AM')
  })

  it('falls back to the first letter of the email without a name', () => {
    expect(initialsOf(null, 'vera@example.com')).toBe('V')
    expect(initialsOf('   ', 'vera@example.com')).toBe('V')
    expect(initialsOf(undefined, 'vera@example.com')).toBe('V')
  })
})

describe('avatarError (story 021, AC 7–8)', () => {
  it('accepts JPEG, PNG and WebP up to 2 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(avatarError({ type, size: MAX_AVATAR_BYTES })).toBeNull()
    }
  })

  it('refuses a file over 2 MB', () => {
    expect(avatarError({ type: 'image/png', size: MAX_AVATAR_BYTES + 1 })).toBe('too_large')
  })

  it('refuses anything that is not a supported image, and an empty file', () => {
    expect(avatarError({ type: 'application/pdf', size: 100 })).toBe('invalid_type')
    expect(avatarError({ type: 'image/svg+xml', size: 100 })).toBe('invalid_type')
    expect(avatarError({ type: 'image/png', size: 0 })).toBe('empty')
  })
})

describe('formatStartDate (story 021, AC 1)', () => {
  it('writes the calendar date in the page locale without shifting the day', () => {
    expect(formatStartDate('2026-10-01', 'ru')).toBe('1 октября 2026 г.')
    expect(formatStartDate('2026-10-01', 'en')).toBe('October 1, 2026')
    expect(formatStartDate('2026-12-31', 'en')).toBe('December 31, 2026')
  })
})

describe('sniffImageType (story 021, AC 8)', () => {
  it('recognises JPEG, PNG and WebP by their first bytes', () => {
    expect(sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      'image/png',
    )
    const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
    expect(sniffImageType(webp)).toBe('image/webp')
  })

  it('does not trust a name or type: a PDF or HTML body is unknown', () => {
    expect(sniffImageType(new TextEncoder().encode('%PDF-1.4'))).toBeNull()
    expect(sniffImageType(new TextEncoder().encode('<script>'))).toBeNull()
    expect(sniffImageType(new Uint8Array())).toBeNull()
  })
})
