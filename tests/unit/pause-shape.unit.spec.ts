import { describe, expect, it } from 'vitest'

import {
  dateOfProgramDay,
  isPausedOn,
  pausedDaysBefore,
  programDay,
  programDayOnDate,
  resolvePauses,
} from '@/features/enrollments/shape'
import {
  isOver,
  progressTotals,
  weekGrid,
  weekOf,
  type DayProgress,
  type TemplateDay,
} from '@/features/study-today/shape'

// Almaty is UTC+5, so noon UTC is always the same calendar day there.
const noon = (ymd: string) => new Date(`${ymd}T07:00:00.000Z`)
const START = '2026-10-01'
const day = (ymd: string, pauses: { from: string; to?: string | null }[] = []) =>
  programDay(START, 'Asia/Almaty', noon(ymd), pauses)

describe('pauses (story 017)', () => {
  describe('resolvePauses', () => {
    it('closes an open pause through today and sorts by start', () => {
      expect(
        resolvePauses(
          [{ from: '2026-10-20T00:00:00.000Z' }, { from: '2026-10-05', to: '2026-10-07' }],
          '2026-10-25',
        ),
      ).toEqual([
        { from: '2026-10-05', to: '2026-10-07' },
        { from: '2026-10-20', to: '2026-10-25' },
      ])
    })

    it('merges overlapping and back-to-back pauses and drops one that ends before it starts', () => {
      expect(
        resolvePauses(
          [
            { from: '2026-10-05', to: '2026-10-07' },
            { from: '2026-10-08', to: '2026-10-09' },
            { from: '2026-10-09', to: '2026-10-12' },
            { from: '2026-10-20', to: '2026-10-19' },
          ],
          '2026-10-30',
        ),
      ).toEqual([{ from: '2026-10-05', to: '2026-10-12' }])
    })

    it('knows nothing of a missing list', () => {
      expect(resolvePauses(null, '2026-10-30')).toEqual([])
      expect(resolvePauses(undefined, '2026-10-30')).toEqual([])
    })
  })

  describe('programDay (AC 2, 4, 8)', () => {
    const pause = [{ from: '2026-10-05', to: '2026-10-07' }] // three paused days

    it('does not change without pauses', () => {
      expect(day('2026-10-01')).toBe(1)
      expect(day('2026-10-09')).toBe(9)
    })

    it('counts the days before a pause as usual', () => {
      expect(day('2026-10-04', pause)).toBe(4)
    })

    it('stands still during a pause', () => {
      expect(day('2026-10-05', pause)).toBe(5)
      expect(day('2026-10-06', pause)).toBe(5)
      expect(day('2026-10-07', pause)).toBe(5)
    })

    it('is the same number again on the day after a pause of three days (AC 2)', () => {
      expect(day('2026-10-08', pause)).toBe(5)
      expect(day('2026-10-09', pause)).toBe(6)
    })

    it('stands still while a pause is open, however long (AC 4: 200 days)', () => {
      const open = [{ from: '2026-10-05' }]
      expect(day('2026-10-05', open)).toBe(5)
      expect(day('2027-04-24', open)).toBe(5)
    })

    it('subtracts every earlier pause: before and after the second one', () => {
      const two = [
        { from: '2026-10-05', to: '2026-10-07' }, // 3 days
        { from: '2026-10-12', to: '2026-10-13' }, // 2 days
      ]
      expect(day('2026-10-11', two)).toBe(8) // 10 − 3 + … day 11 → 11 − 3 = 8
      expect(day('2026-10-12', two)).toBe(9)
      expect(day('2026-10-13', two)).toBe(9)
      expect(day('2026-10-14', two)).toBe(9)
      expect(day('2026-10-15', two)).toBe(10)
    })

    it('a pause across a week boundary shifts the next week, not the numbers before it', () => {
      const across = [{ from: '2026-10-06', to: '2026-10-10' }] // program day 7 would be Oct 7
      expect(day('2026-10-05', across)).toBe(5)
      expect(weekOf(day('2026-10-05', across))).toBe(1)
      expect(day('2026-10-11', across)).toBe(6)
      expect(day('2026-10-13', across)).toBe(8)
      expect(weekOf(day('2026-10-13', across))).toBe(2)
    })

    it('uses the date in the student’s zone: the day changes at her midnight', () => {
      const p = [{ from: '2026-10-05', to: '2026-10-05' }]
      const beforeMidnight = new Date('2026-10-06T18:59:00.000Z') // Oct 06 23:59 Almaty
      const afterMidnight = new Date('2026-10-06T19:01:00.000Z') // Oct 07 00:01 Almaty
      expect(programDay(START, 'Asia/Almaty', beforeMidnight, p)).toBe(5)
      expect(programDay(START, 'Asia/Almaty', afterMidnight, p)).toBe(6)
    })
  })

  describe('the last program day (AC 8)', () => {
    const weeks = 1 // a program of 7 days

    it('without a pause the program is over on the 8th day', () => {
      expect(isOver(day('2026-10-07'), weeks)).toBe(false)
      expect(isOver(day('2026-10-08'), weeks)).toBe(true)
    })

    it('a pause on the last day keeps the program open for as long as it lasts', () => {
      const open = [{ from: '2026-10-07' }] // paused on day 7
      expect(isOver(day('2026-10-07', open), weeks)).toBe(false)
      expect(isOver(day('2026-12-31', open), weeks)).toBe(false)
    })

    it('after the pause day 7 is again today and the program ends a day later', () => {
      const closed = [{ from: '2026-10-07', to: '2026-10-16' }] // ten paused days
      expect(day('2026-10-17', closed)).toBe(7)
      expect(isOver(day('2026-10-17', closed), weeks)).toBe(false)
      expect(isOver(day('2026-10-18', closed), weeks)).toBe(true)
    })
  })

  describe('dates and program days map both ways', () => {
    const ranges = resolvePauses(
      [
        { from: '2026-10-05', to: '2026-10-07' },
        { from: '2026-10-12', to: '2026-10-13' },
      ],
      '2026-11-01',
    )

    it('isPausedOn and pausedDaysBefore', () => {
      expect(isPausedOn(ranges, '2026-10-04')).toBe(false)
      expect(isPausedOn(ranges, '2026-10-05')).toBe(true)
      expect(isPausedOn(ranges, '2026-10-07')).toBe(true)
      expect(isPausedOn(ranges, '2026-10-08')).toBe(false)
      expect(pausedDaysBefore(ranges, '2026-10-05')).toBe(0)
      expect(pausedDaysBefore(ranges, '2026-10-08')).toBe(3)
      expect(pausedDaysBefore(ranges, '2026-10-20')).toBe(5)
    })

    it('every program day has one study date outside the pauses, in order', () => {
      const dates = Array.from({ length: 20 }, (_, i) => dateOfProgramDay(START, i + 1, ranges))
      for (const [i, date] of dates.entries()) {
        expect(isPausedOn(ranges, date)).toBe(false)
        expect(programDayOnDate(START, date, ranges)).toBe(i + 1)
      }
      expect(dates.slice(3, 6)).toEqual(['2026-10-04', '2026-10-08', '2026-10-09'])
    })

    it('a paused date has the number of the day it interrupted', () => {
      expect(programDayOnDate(START, '2026-10-05', ranges)).toBe(5)
      expect(programDayOnDate(START, '2026-10-07', ranges)).toBe(5)
    })
  })

  describe('weekGrid (AC 3)', () => {
    const template: TemplateDay[] = Array.from({ length: 7 }, () => ({ slots: [{ minutes: 10 }] }))
    const progress = new Map<number, DayProgress>()

    it('shows paused calendar days with the paused state and no program day', () => {
      const pauses = resolvePauses([{ from: '2026-10-05', to: '2026-10-07' }], '2026-10-20')
      const cells = weekGrid({ week: 1, startDate: START, today: 6, template, progress, pauses })
      expect(cells.map((cell) => cell.date)).toEqual([
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04',
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-08',
        '2026-10-09',
        '2026-10-10',
      ])
      expect(
        cells.filter((cell) => cell.state === 'paused').map((cell) => cell.programDay),
      ).toEqual([null, null, null])
      expect(cells.filter((cell) => cell.programDay != null)).toHaveLength(7)
      expect(cells.find((cell) => cell.state === 'today')?.date).toBe('2026-10-09')
    })

    it('is the plain 7 days without pauses', () => {
      const cells = weekGrid({
        week: 2,
        startDate: START,
        today: 9,
        template,
        progress,
        pauses: [],
      })
      expect(cells.map((cell) => cell.programDay)).toEqual([8, 9, 10, 11, 12, 13, 14])
    })

    it('gives paused days between two weeks to the later week, once', () => {
      const pauses = resolvePauses([{ from: '2026-10-08', to: '2026-10-10' }], '2026-10-20')
      const week1 = weekGrid({ week: 1, startDate: START, today: 8, template, progress, pauses })
      const week2 = weekGrid({ week: 2, startDate: START, today: 8, template, progress, pauses })
      expect(week1.at(-1)?.date).toBe('2026-10-07')
      expect(week2.map((cell) => cell.date).slice(0, 4)).toEqual([
        '2026-10-08',
        '2026-10-09',
        '2026-10-10',
        '2026-10-11',
      ])
      expect(week2.slice(0, 3).every((cell) => cell.state === 'paused')).toBe(true)
    })

    it('does not mark a day as today while she is paused', () => {
      const pauses = resolvePauses([{ from: '2026-10-05' }], '2026-10-06')
      const cells = weekGrid({
        week: 1,
        startDate: START,
        today: 5,
        template,
        progress,
        pauses,
        paused: true,
      })
      expect(cells.some((cell) => cell.state === 'today')).toBe(false)
      expect(cells.filter((cell) => cell.state === 'paused').map((cell) => cell.date)).toEqual([
        '2026-10-05',
        '2026-10-06',
      ])
    })
  })

  describe('progressTotals', () => {
    it('a paused stretch is not missed: only program days count', () => {
      const template: TemplateDay[] = Array.from({ length: 7 }, () => ({
        slots: [{ minutes: 10 }],
      }))
      const progress = new Map<number, DayProgress>([[1, { done: true, minutes: 10 }]])
      // Days 1–2 before the pause, 39 paused days, Nov 11 is day 3 and Nov 12 day 4.
      const today = day('2026-11-12', [{ from: '2026-10-03', to: '2026-11-10' }])
      expect(today).toBe(4)
      expect(progressTotals({ today, totalDays: 364, template, progress })).toMatchObject({
        done: 1,
        missed: 2,
      })
    })
  })
})
