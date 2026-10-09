import { describe, expect, it } from 'vitest'

import { isValidMinutes, isValidSlug, levelsInOrder } from '@/features/programs/shape'

describe('program shape rules (story 009)', () => {
  it('orders CEFR levels strictly', () => {
    expect(levelsInOrder('A2', 'B1')).toBe(true)
    expect(levelsInOrder('C1', 'C2')).toBe(true)
    expect(levelsInOrder('B2', 'B1')).toBe(false)
    expect(levelsInOrder('B1', 'B1')).toBe(false)
  })

  it('leaves missing or unknown levels to the select field', () => {
    expect(levelsInOrder(undefined, 'B1')).toBe(true)
    expect(levelsInOrder('B1', 'nope')).toBe(true)
  })

  it('accepts whole minutes from 1 to 240 only', () => {
    expect([1, 20, 240].every(isValidMinutes)).toBe(true)
    expect([0, 241, 1.5, -5, '20', null].some(isValidMinutes)).toBe(false)
  })

  it('accepts lowercase hyphenated slugs up to 60 characters', () => {
    expect(['a2-b1', 'b1', '90-90-1', 'a'.repeat(60)].every(isValidSlug)).toBe(true)
    expect(['', 'A2', 'a_b', '-a', 'a-', 'a--b', 'a b', 'a'.repeat(61)].some(isValidSlug)).toBe(
      false,
    )
  })
})
