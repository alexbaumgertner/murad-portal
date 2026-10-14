import { describe, expect, it } from 'vitest'

import {
  daysLeft,
  deadlineStats,
  fourWeekGroups,
  percentOf,
  weekStats,
  type TaskCell,
} from '@/features/planner/progress'

const task = (text: string, done = false): TaskCell => ({ text, done })

describe('story 024 · progress', () => {
  it('1/2/3. counts only real tasks; a week without tasks has no percent', () => {
    expect(weekStats([])).toEqual({ total: 0, done: 0 })
    expect(weekStats([task(''), task('-'), task(' — ', true)])).toEqual({ total: 0, done: 0 })
    expect(percentOf(weekStats([]))).toBeNull()
    expect(percentOf(weekStats([task('A', true)]))).toBe(100)
    expect(percentOf(weekStats([task('A', true), task('B')]))).toBe(50)
    expect(
      percentOf(weekStats([task('A', true), task('B', true), task('C', true), task('D')])),
    ).toBe(75)
    expect(percentOf(weekStats(Array.from({ length: 10 }, () => task('x'))))).toBe(0)
    expect(percentOf(weekStats([task('A', true), task('B')].slice(0, 1)))).toBe(100)
  })

  it('3. a ticked cell whose text was cleared does not count', () => {
    expect(weekStats([task('', true), task('A', true)])).toEqual({ total: 1, done: 1 })
  })

  it('4. groups weeks by four, with dates across months and years; a partial group is kept', () => {
    const weeks = [0, 1, 2, 3, 4, 5].map((index) => ({ index, total: 1, done: 0 }))
    const groups = fourWeekGroups('2026-10-12', weeks)
    expect(groups.map((g) => [g.first, g.last, g.start, g.end])).toEqual([
      [0, 3, '2026-10-12', '2026-11-08'],
      [4, 5, '2026-11-09', '2026-11-22'],
    ])
    const years = fourWeekGroups(
      '2026-12-14',
      [0, 1, 2, 3].map((index) => ({ index, total: 0, done: 0 })),
    )
    expect([years[0]!.start, years[0]!.end]).toEqual(['2026-12-14', '2027-01-10'])
  })

  it('5. weights by tasks, not by weekly averages', () => {
    const [group] = fourWeekGroups('2026-10-12', [
      { index: 0, total: 1, done: 1 },
      { index: 1, total: 9, done: 0 },
    ])
    expect(group).toMatchObject({ total: 10, done: 1 })
    expect(percentOf(group!)).toBe(10)
  })

  it('5/6. gaps are skipped; an empty group has no percent', () => {
    const groups = fourWeekGroups('2026-10-12', [
      { index: 1, total: 0, done: 0 },
      { index: 6, total: 2, done: 1 },
    ])
    expect(groups.map((g) => [g.first, g.last, percentOf(g)])).toEqual([
      [1, 1, null],
      [6, 6, 50],
    ])
    expect(groups[1]!.start).toBe('2026-11-23')
  })

  it('7/9. counts only tasks dated on or before the deadline', () => {
    const tasks = [
      { date: '2026-11-13', text: 'A', done: true },
      { date: '2026-11-14', text: 'B', done: false },
      { date: '2026-11-15', text: 'C', done: true },
      { date: '2026-11-16', text: 'D', done: true },
      { date: '2026-11-15', text: '-', done: true },
    ]
    const stats = deadlineStats(tasks, '2026-11-15', '2026-11-01')
    expect(stats).toMatchObject({ total: 3, done: 2, daysLeft: 14, state: 'left' })
    expect(percentOf(stats)).toBe(67)
    expect(
      percentOf(
        deadlineStats([{ date: '2026-11-16', text: 'D', done: true }], '2026-11-15', '2026-11-01'),
      ),
    ).toBeNull()
  })

  it('8. days left are calendar days: today, overdue, over DST and year ends', () => {
    expect(daysLeft('2026-12-20', '2026-10-14')).toBe(67)
    expect(daysLeft('2026-10-14', '2026-10-14')).toBe(0)
    expect(daysLeft('2026-10-13', '2026-10-14')).toBe(-1)
    expect(daysLeft('2027-01-02', '2026-12-30')).toBe(3)
    expect(daysLeft('2026-03-30', '2026-03-28')).toBe(2)
    expect(deadlineStats([], '2026-10-14', '2026-10-14').state).toBe('today')
    expect(deadlineStats([], '2026-10-13', '2026-10-14').state).toBe('overdue')
  })
})
