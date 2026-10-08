import { describe, expect, it } from 'vitest'

import {
  blockOf,
  dayNumberOn,
  endsAt,
  percent,
  summarize,
  type ChallengeShape,
  type DayRecord,
} from '@/features/challenge/progress'
import { checkChallengeShape, isValidTimeZone } from '@/features/challenge/shape'

const ALMATY = 'Asia/Almaty'

// Payload's day-only date picker stores noon UTC; the calendar date is the UTC date part.
const challenge = {
  startDate: '2026-10-07T12:00:00.000Z',
  timeZone: ALMATY,
  durationDays: 90,
  dailyMinutes: 90,
  blockDays: 15,
  videos: Array.from({ length: 6 }, () => ({ publishedAt: null as string | null })),
} satisfies ChallengeShape

const closed = (dayNumber: number, minutes = 90): DayRecord => ({
  dayNumber,
  minutes,
  closedAt: '2026-10-10T12:00:00.000Z',
})

describe('dayNumberOn', () => {
  it('is day 1 at 23:30 Astana on the start date (18:30 UTC)', () => {
    const now = new Date('2026-10-07T18:30:00.000Z')
    expect(dayNumberOn(now, challenge.startDate, ALMATY)).toBe(1)
  })

  it('is day 2 at 00:10 Astana the next morning (19:10 UTC)', () => {
    const now = new Date('2026-10-07T19:10:00.000Z')
    expect(dayNumberOn(now, challenge.startDate, ALMATY)).toBe(2)
  })

  it('is still day 1 at 23:59:59 and day 2 at 00:00:00 Astana', () => {
    expect(dayNumberOn(new Date('2026-10-07T18:59:59.000Z'), challenge.startDate, ALMATY)).toBe(1)
    expect(dayNumberOn(new Date('2026-10-07T19:00:00.000Z'), challenge.startDate, ALMATY)).toBe(2)
  })

  it('uses the time zone, not UTC, to decide the date', () => {
    // 02:00 UTC on 2026-10-07 is already 07:00 in Astana, but still the 6th in New York.
    const now = new Date('2026-10-07T02:00:00.000Z')
    expect(dayNumberOn(now, '2026-10-07', ALMATY)).toBe(1)
    expect(dayNumberOn(now, '2026-10-07', 'America/New_York')).toBe(0)
  })

  it('is 0 or negative before the start date', () => {
    expect(dayNumberOn(new Date('2026-10-06T18:59:59.000Z'), challenge.startDate, ALMATY)).toBe(0)
    expect(dayNumberOn(new Date('2026-10-01T12:00:00.000Z'), challenge.startDate, ALMATY)).toBe(-5)
  })

  it('accepts a plain YYYY-MM-DD start date', () => {
    expect(dayNumberOn(new Date('2026-10-08T00:00:00.000Z'), '2026-10-07', ALMATY)).toBe(2)
  })

  it('counts calendar days across a DST change', () => {
    // Berlin leaves DST on 2026-10-25 (a 25-hour day): day numbers must not skip or repeat.
    const berlin = (iso: string) => dayNumberOn(new Date(iso), '2026-10-24', 'Europe/Berlin')
    expect(berlin('2026-10-24T22:00:00.000Z')).toBe(2) // 25 Oct 00:00 CEST
    expect(berlin('2026-10-25T22:59:59.000Z')).toBe(2) // 25 Oct 23:59:59 CET
    expect(berlin('2026-10-25T23:00:00.000Z')).toBe(3) // 26 Oct 00:00 CET
  })
})

describe('blockOf', () => {
  it('maps days 1–15 to block 1 and day 16 to block 2', () => {
    const blocks = Array.from({ length: 20 }, (_, i) => blockOf(i + 1, 15))
    expect(blocks.slice(0, 15)).toEqual(Array(15).fill(1))
    expect(blocks.slice(15)).toEqual(Array(5).fill(2))
  })

  it('puts day 90 into block 6', () => {
    expect(blockOf(90, 15)).toBe(6)
  })
})

describe('endsAt', () => {
  it('is the local midnight after the last day', () => {
    // Day 90 is 2027-01-04; the challenge ends at 2027-01-05 00:00 Astana = 2027-01-04 19:00 UTC.
    expect(endsAt(challenge).toISOString()).toBe('2027-01-04T19:00:00.000Z')
  })

  it('follows the offset of the end date, not of the start date', () => {
    const berlin = { startDate: '2026-10-24', timeZone: 'Europe/Berlin', durationDays: 3 }
    // Days: 24, 25, 26 Oct → ends 27 Oct 00:00 CET (UTC+1) = 26 Oct 23:00 UTC.
    expect(endsAt(berlin).toISOString()).toBe('2026-10-26T23:00:00.000Z')
  })
})

describe('summarize', () => {
  const at = (iso: string) => new Date(iso)

  it('counts minutes, sessions and the 8 100-minute target on day 4', () => {
    const days = [closed(1), closed(2), closed(3)]
    const s = summarize(challenge, days, at('2026-10-10T08:00:00.000Z'))
    expect(s).toMatchObject({
      status: 'running',
      todayNumber: 4,
      minutesDone: 270,
      minutesTarget: 8100,
      sessionsDone: 3,
      sessionsPlanned: 4,
      videosTarget: 6,
      daysLeft: 87,
    })
  })

  it('reports the real minutes when days exceed the daily target', () => {
    const s = summarize(challenge, [closed(1, 150), closed(2, 90)], at('2026-10-09T08:00:00.000Z'))
    expect(s.minutesDone).toBe(240)
    expect(s.minutesTarget).toBe(8100)
  })

  it('ignores days that are logged but not closed', () => {
    const open: DayRecord = { dayNumber: 2, minutes: 30, closedAt: null }
    const s = summarize(challenge, [closed(1), open], at('2026-10-09T08:00:00.000Z'))
    expect(s.minutesDone).toBe(90)
    expect(s.sessionsDone).toBe(1)
  })

  it('is not-started before the start date', () => {
    const s = summarize(challenge, [], at('2026-10-06T08:00:00.000Z'))
    expect(s).toMatchObject({
      status: 'not-started',
      todayNumber: null,
      sessionsPlanned: 0,
      sessionsDone: 0,
      daysLeft: 90,
    })
  })

  it('is finished after the end, with no negative days left', () => {
    const s = summarize(challenge, [closed(1)], at('2027-02-01T08:00:00.000Z'))
    expect(s).toMatchObject({
      status: 'finished',
      todayNumber: null,
      sessionsPlanned: 90,
      daysLeft: 0,
    })
    expect(s.daysLeft).toBeGreaterThanOrEqual(0)
  })

  it('is still running on day 90 and finished at the next local midnight', () => {
    expect(summarize(challenge, [], at('2027-01-04T18:59:59.000Z'))).toMatchObject({
      status: 'running',
      todayNumber: 90,
      daysLeft: 1,
    })
    expect(summarize(challenge, [], at('2027-01-04T19:00:00.000Z')).status).toBe('finished')
  })

  it('counts videos published up to now', () => {
    const videos = [
      { publishedAt: '2026-10-20T10:00:00.000Z' },
      { publishedAt: '2026-11-05T10:00:00.000Z' },
      { publishedAt: null },
      {},
      { publishedAt: '2026-12-01T10:00:00.000Z' },
      { publishedAt: null },
    ]
    const s = summarize({ ...challenge, videos }, [], at('2026-11-10T08:00:00.000Z'))
    expect(s.videosPublished).toBe(2)
    expect(s.videosTarget).toBe(6)
  })

  it('ignores days outside the challenge', () => {
    const s = summarize(
      challenge,
      [closed(0), closed(91), closed(1)],
      at('2026-10-09T08:00:00.000Z'),
    )
    expect(s.minutesDone).toBe(90)
    expect(s.sessionsDone).toBe(1)
  })
})

describe('percent', () => {
  it('caps at 100 for display while the real value stays above', () => {
    expect(percent(8100, 8100)).toBe(100)
    expect(percent(9000, 8100)).toBe(100)
  })

  it('rounds and handles an empty target', () => {
    expect(percent(270, 8100)).toBe(3)
    expect(percent(0, 8100)).toBe(0)
    expect(percent(5, 0)).toBe(0)
  })
})

describe('checkChallengeShape', () => {
  it('accepts the defaults with six videos', () => {
    expect(checkChallengeShape({ durationDays: 90, blockDays: 15, videosCount: 6 })).toBeNull()
  })

  it('rejects a duration that is not divisible by the block length', () => {
    expect(checkChallengeShape({ durationDays: 90, blockDays: 20, videosCount: 4 })).toMatch(
      /divisible/i,
    )
  })

  it('rejects a videos count different from durationDays / blockDays', () => {
    expect(checkChallengeShape({ durationDays: 90, blockDays: 15, videosCount: 5 })).toMatch(
      /exactly 6 videos/i,
    )
    expect(checkChallengeShape({ durationDays: 90, blockDays: 15, videosCount: 0 })).toMatch(
      /exactly 6 videos/i,
    )
  })

  it('rejects non-positive or non-integer values', () => {
    expect(checkChallengeShape({ durationDays: 90, blockDays: 0, videosCount: 0 })).not.toBeNull()
    expect(
      checkChallengeShape({ durationDays: 7.5, blockDays: 2.5, videosCount: 3 }),
    ).not.toBeNull()
  })
})

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects junk', () => {
    expect(isValidTimeZone('Asia/Almaty')).toBe(true)
    expect(isValidTimeZone('Europe/Berlin')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })
})
