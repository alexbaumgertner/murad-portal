import { describe, expect, it } from 'vitest'

import { programDay } from '@/features/enrollments/shape'
import {
  dateOfDay,
  dayState,
  firstDayOfWeek,
  formatCalendarDate,
  isOver,
  progressTotals,
  templateDayOf,
  trainingDaysIn,
  weekCells,
  weekCount,
  weekOf,
  type DayProgress,
  type TemplateDay,
} from '@/features/study-today/shape'

// Template: Mon-like day 1–6 have slots, day 4 is a rest day.
const slots = [{ minutes: 20 }, { minutes: 40 }]
const template: TemplateDay[] = [slots, slots, slots, [], slots, slots, slots].map((s) => ({
  slots: s,
}))
const none = new Map<number, DayProgress>()

describe('story 013 · program day arithmetic', () => {
  it('counts the start date as day 1 and puts week boundaries at 7 / 8', () => {
    expect([1, 7, 8, 14, 15].map(weekOf)).toEqual([1, 1, 2, 2, 3])
    expect([1, 7, 8, 10].map(templateDayOf)).toEqual([1, 7, 1, 3])
    expect([1, 2, 3].map(firstDayOfWeek)).toEqual([1, 8, 15])
  })

  it('knows the last program day: 364 of 52 weeks is still running, 365 is over', () => {
    expect(isOver(364, 52)).toBe(false)
    expect(isOver(365, 52)).toBe(true)
  })

  it('maps a program day to its calendar date', () => {
    expect(dateOfDay('2026-10-01T00:00:00.000Z', 1)).toBe('2026-10-01')
    expect(dateOfDay('2026-10-01', 10)).toBe('2026-10-10')
    expect(dateOfDay('2026-12-30', 3)).toBe('2027-01-01')
  })

  it('AC 9 · computes «today» in Asia/Almaty, not on the device clock (23:30 UTC)', () => {
    const before = new Date('2026-10-09T18:59:00.000Z') // 23:59 in Almaty
    const after = new Date('2026-10-09T19:01:00.000Z') // 00:01 next day in Almaty
    const lateUtc = new Date('2026-10-09T23:30:00.000Z') // already the 10th in Almaty
    expect(programDay('2026-10-01', 'Asia/Almaty', before)).toBe(9)
    expect(programDay('2026-10-01', 'Asia/Almaty', after)).toBe(10)
    expect(programDay('2026-10-01', 'Asia/Almaty', lateUtc)).toBe(10)
    expect(programDay('2026-10-01', 'UTC', lateUtc)).toBe(9)
  })

  it('AC 1 · day 10 is week 2, template day 3', () => {
    expect(weekOf(10)).toBe(2)
    expect(templateDayOf(10)).toBe(3)
  })
})

describe('story 013 · day states (marker besides colour)', () => {
  const base = { today: 10, template }
  it('is missed for a past training day with nothing logged', () => {
    expect(dayState({ ...base, programDay: 8 })).toBe('missed')
  })
  it('is done / partial from what was logged', () => {
    expect(dayState({ ...base, programDay: 8, progress: { done: true, minutes: 60 } })).toBe('done')
    expect(dayState({ ...base, programDay: 8, progress: { done: false, minutes: 15 } })).toBe(
      'partial',
    )
  })
  it('is today for the current day, upcoming for a future one', () => {
    expect(dayState({ ...base, programDay: 10 })).toBe('today')
    expect(dayState({ ...base, programDay: 12 })).toBe('upcoming')
  })
  it('is rest for a rest template day in the past or future, but today stays today', () => {
    expect(dayState({ ...base, programDay: 4 })).toBe('rest')
    expect(dayState({ ...base, programDay: 11 })).toBe('rest')
    expect(dayState({ today: 4, programDay: 4, template })).toBe('today')
  })
  it('is paused inside a pause', () => {
    expect(dayState({ ...base, programDay: 8, paused: true })).toBe('paused')
  })
})

describe('story 013 · grid and totals', () => {
  it('AC 3 · builds 7 cells for the current week with dates and states', () => {
    const cells = weekCells({
      week: 2,
      startDate: '2026-10-01',
      today: 10,
      template,
      progress: none,
    })
    expect(cells).toHaveLength(7)
    expect(cells.map((c) => c.programDay)).toEqual([8, 9, 10, 11, 12, 13, 14])
    expect(cells.map((c) => c.date)).toEqual([
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
    ])
    expect(cells.map((c) => c.state)).toEqual([
      'missed',
      'missed',
      'today',
      'rest',
      'upcoming',
      'upcoming',
      'upcoming',
    ])
  })

  it('AC 1 · counts done, missed and minutes; until marking exists every past day is missed', () => {
    // Days 1–9: week 1 has 6 training days, days 8 and 9 are two more; day 4 is a rest day.
    expect(progressTotals({ today: 10, totalDays: 364, template, progress: none })).toEqual({
      done: 0,
      missed: 8,
      minutes: 0,
    })
    const progress = new Map<number, DayProgress>([
      [1, { done: true, minutes: 60 }],
      [2, { done: false, minutes: 20 }],
    ])
    expect(progressTotals({ today: 10, totalDays: 364, template, progress })).toEqual({
      done: 1,
      missed: 7,
      minutes: 80,
    })
  })

  it('AC 8 · for a finished program every training day is done or missed', () => {
    const totals = progressTotals({ today: 365, totalDays: 364, template, progress: none })
    expect(totals.missed).toBe(trainingDaysIn(52, template))
    expect(trainingDaysIn(52, template)).toBe(6 * 52)
  })

  it('AC 5 · counts done of total training days in a week, rest days excluded', () => {
    const progress = new Map<number, DayProgress>([[1, { done: true, minutes: 60 }]])
    expect(weekCount({ week: 1, template, progress })).toEqual({ done: 1, total: 6 })
    expect(weekCount({ week: 2, template, progress })).toEqual({ done: 0, total: 6 })
  })

  it('formats a calendar date without shifting it by a time zone', () => {
    expect(formatCalendarDate('2026-10-10', 'en').dayOfMonth).toBe('10')
    expect(formatCalendarDate('2026-10-10', 'en').weekday).toBe('Sat')
    expect(formatCalendarDate('2026-10-10', 'ru').long).toContain('10')
  })
})
