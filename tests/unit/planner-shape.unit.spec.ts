import { describe, expect, it } from 'vitest'

import {
  addDays,
  effectiveTaskTypes,
  isAssignedTask,
  mondayOf,
  roman,
  weekDates,
  weekLabel,
} from '@/features/planner/shape'

describe('story 022 · planner shape', () => {
  it('2. normalizes any date to the Monday of its week', () => {
    expect(mondayOf('2026-10-14')).toBe('2026-10-12') // Wednesday
    expect(mondayOf('2026-10-12')).toBe('2026-10-12')
    expect(mondayOf('2026-10-18')).toBe('2026-10-12') // Sunday
    expect(mondayOf('2027-01-01')).toBe('2026-12-28')
  })

  it('3. adds calendar days across month, year, leap day and DST', () => {
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30') // EU DST change
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02') // US DST change
  })

  it('3. lists Monday…Sunday of week N from the base date', () => {
    expect(weekDates('2026-12-28', 0)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ])
    expect(weekDates('2026-12-28', 1)[0]).toBe('2027-01-04')
  })

  it('3. numbers weeks from 01', () => {
    expect(weekLabel(0)).toBe('WEEK 01')
    expect(weekLabel(11)).toBe('WEEK 12')
  })

  it('5. makes Roman numerals for 1…40', () => {
    const expected: Record<number, string> = {
      1: 'I',
      4: 'IV',
      9: 'IX',
      14: 'XIV',
      19: 'XIX',
      24: 'XXIV',
      29: 'XXIX',
      30: 'XXX',
      34: 'XXXIV',
      39: 'XXXIX',
      40: 'XL',
    }
    for (const [n, value] of Object.entries(expected)) expect(roman(Number(n))).toBe(value)
  })

  it('10. treats blank, whitespace and dashes as no task', () => {
    for (const text of ['', '   ', '-', ' - ', '—', '–', '--'])
      expect(isAssignedTask(text)).toBe(false)
    expect(isAssignedTask(null)).toBe(false)
    for (const text of ['ANKI', 'read 20 pages', 'Читать 20 страниц', '- item'])
      expect(isAssignedTask(text)).toBe(true)
  })
})

describe('story 029 · task types', () => {
  it('uses the saved list, else the distinct tasks already written', () => {
    expect(effectiveTaskTypes(['A'], ['B'])).toEqual(['A'])
    expect(effectiveTaskTypes([], ['ANKI', ' ANKI ', '-', '', 'PODCAST'])).toEqual([
      'ANKI',
      'PODCAST',
    ])
  })
})
