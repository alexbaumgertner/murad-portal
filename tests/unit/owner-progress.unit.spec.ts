import { describe, expect, it } from 'vitest'

import { groupSlotLogs } from '@/features/slot-timer/shape'
import { latestStudyDate, summarize } from '@/features/owner-progress/shape'

// Day 1 is 2026-10-01 in Almaty (UTC+5); 10:00 on 2026-10-10 is program day 10.
const NOW = new Date('2026-10-10T05:00:00.000Z')
const template = [
  { slots: [{ minutes: 20 }, { minutes: 40 }] },
  { slots: [{ minutes: 20 }] },
  { slots: [] },
  { slots: [{ minutes: 20 }] },
  { slots: [{ minutes: 20 }] },
  { slots: [{ minutes: 20 }] },
  { slots: [{ minutes: 20 }] },
]
const base = {
  id: 1,
  name: 'Анна',
  programTitle: 'От B1 к B2',
  levelFrom: 'B1',
  levelTo: 'B2',
  durationWeeks: 4,
  startDate: '2026-10-01T00:00:00.000Z',
  timezone: 'Asia/Almaty',
  pauses: [] as { from: string; to?: string | null }[],
}
const log = (date: string, slotIndex: number, minutes: number, completed: boolean) => ({
  date: `${date}T00:00:00.000Z`,
  slotIndex,
  minutes,
  completed,
})

describe('groupSlotLogs', () => {
  it('sums a slot logged on two dates of one program day and takes the progress from it', () => {
    const { progress, byDay } = groupSlotLogs(
      [
        log('2026-10-01', 0, 20, true),
        log('2026-10-01', 1, 40, true),
        log('2026-10-02', 0, 5, false),
      ],
      { startDate: '2026-10-01', template },
    )
    expect(progress.get(1)).toEqual({ done: true, minutes: 60 })
    expect(progress.get(2)).toEqual({ done: false, minutes: 5 })
    expect(byDay.get(1)).toHaveLength(2)
  })
})

describe('summarize', () => {
  it('summarizes an active program: day, totals and the last study day', () => {
    const row = summarize({
      enrollment: { ...base, status: 'active' },
      template,
      logs: [
        log('2026-10-01', 0, 20, true),
        log('2026-10-01', 1, 40, true), // day 1 done
        log('2026-10-02', 0, 25, true), // day 2 done
        log('2026-10-04', 0, 10, false), // day 4 partial: counts as missed
      ],
      now: NOW,
    })
    expect(row).toMatchObject({
      status: 'active',
      today: 10,
      totalDays: 28,
      lastStudyDate: '2026-10-04',
      totals: { done: 2, minutes: 95 },
    })
    // Days 1–9 minus the rest day 3: 8 training days, 2 done.
    expect(row.totals?.missed).toBe(6)
  })

  it('a paused program keeps the day it stopped on, and the open pause is on the grid', () => {
    const row = summarize({
      enrollment: { ...base, status: 'paused', pauses: [{ from: '2026-10-06T00:00:00.000Z' }] },
      template,
      logs: [],
      now: NOW,
    })
    expect(row.status).toBe('paused')
    expect(row.today).toBe(6)
    expect(row.pauses).toEqual([{ from: '2026-10-06', to: '2026-10-10' }])
  })

  it('an assigned program has a status and nothing else', () => {
    const row = summarize({
      enrollment: { ...base, status: 'assigned', startDate: null, timezone: null },
      template,
      logs: [],
      now: NOW,
    })
    expect(row).toMatchObject({
      status: 'assigned',
      today: null,
      totals: null,
      lastStudyDate: null,
    })
  })

  it('an active program past its last day is shown as finished, nothing is written', () => {
    const row = summarize({
      enrollment: { ...base, status: 'active', durationWeeks: 1 },
      template,
      logs: [],
      now: NOW,
    })
    expect(row.status).toBe('finished')
  })

  it('a finished program counts every day up to its last one', () => {
    const row = summarize({
      enrollment: { ...base, status: 'finished', durationWeeks: 1 },
      template,
      logs: [log('2026-10-01', 0, 20, true), log('2026-10-01', 1, 40, true)],
      now: NOW,
    })
    expect(row.status).toBe('finished')
    expect(row.totals).toMatchObject({ done: 1, missed: 5 }) // 6 training days in the 7-day week
  })
})

describe('latestStudyDate', () => {
  it('is the newest date with minutes, or null', () => {
    expect(latestStudyDate([log('2026-10-02', 0, 5, false), log('2026-10-07', 0, 0, false)])).toBe(
      '2026-10-02',
    )
    expect(latestStudyDate([])).toBeNull()
  })
})
