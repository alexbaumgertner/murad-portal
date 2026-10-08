import { describe, expect, it } from 'vitest'

import { closeDaySchema } from '@/features/challenge/schema'

const valid = { slug: '90-90-1', dayNumber: '4', minutes: '90', notes: ' Planned the lesson ' }

const codeOf = (input: Record<string, unknown>) => {
  const result = closeDaySchema.safeParse(input)
  return result.success ? null : Object.keys(result.error.flatten().fieldErrors)
}

describe('closeDaySchema', () => {
  it('accepts form values, trims notes and coerces numbers', () => {
    expect(closeDaySchema.parse(valid)).toEqual({
      slug: '90-90-1',
      dayNumber: 4,
      minutes: 90,
      notes: 'Planned the lesson',
    })
  })

  it('treats empty notes as no notes', () => {
    expect(closeDaySchema.parse({ ...valid, notes: '   ' }).notes).toBeUndefined()
    expect(closeDaySchema.parse({ ...valid, notes: undefined }).notes).toBeUndefined()
  })

  it.each(['0', '-1', '1.5', 'abc', '', '366', 'Infinity'])('rejects dayNumber %j', (dayNumber) => {
    expect(codeOf({ ...valid, dayNumber })).toEqual(['dayNumber'])
  })

  it.each(['0', '-5', '601', '90.5', 'abc', '', 'NaN'])('rejects minutes %j', (minutes) => {
    expect(codeOf({ ...valid, minutes })).toEqual(['minutes'])
  })

  it.each(['1', '600'])('accepts the minutes boundary %s', (minutes) => {
    expect(closeDaySchema.parse({ ...valid, minutes }).minutes).toBe(Number(minutes))
  })

  it('accepts 500 characters of notes and rejects 501', () => {
    expect(closeDaySchema.safeParse({ ...valid, notes: 'a'.repeat(500) }).success).toBe(true)
    expect(codeOf({ ...valid, notes: 'a'.repeat(501) })).toEqual(['notes'])
  })

  it('rejects a missing or oversized slug', () => {
    expect(codeOf({ ...valid, slug: '' })).toEqual(['slug'])
    expect(codeOf({ ...valid, slug: 'a'.repeat(101) })).toEqual(['slug'])
  })
})
