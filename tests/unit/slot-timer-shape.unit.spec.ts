import { describe, expect, it } from 'vitest'

import {
  MAX_SLOT_MINUTES,
  MAX_TIMER_MINUTES,
  addedMinutes,
  dayProgressOf,
  elapsedMs,
  isReached,
  minutesBucket,
} from '@/features/slot-timer/shape'

const T0 = new Date('2026-10-10T10:00:00.000Z')
const after = (seconds: number) => new Date(T0.getTime() + seconds * 1000)

describe('slot timer rules (story 014)', () => {
  it('elapsed time is now − timerStartedAt, never negative (D-SP-4)', () => {
    expect(elapsedMs(T0.toISOString(), after(90))).toBe(90_000)
    expect(elapsedMs(after(10).toISOString(), T0)).toBe(0)
  })

  it('7. a timer over 4 hours counts as exactly 240 minutes', () => {
    expect(MAX_TIMER_MINUTES).toBe(240)
    expect(elapsedMs(T0.toISOString(), after(5 * 3600))).toBe(240 * 60_000)
    expect(addedMinutes(elapsedMs(T0.toISOString(), after(9 * 3600)))).toBe(240)
  })

  it('3. whole minutes round down; at least 1 from 30 seconds; less than 30 s adds nothing', () => {
    expect(addedMinutes(0)).toBe(0)
    expect(addedMinutes(29_000)).toBe(0)
    expect(addedMinutes(30_000)).toBe(1)
    expect(addedMinutes(59_999)).toBe(1)
    expect(addedMinutes(61_000)).toBe(1)
    expect(addedMinutes(25 * 60_000 + 59_000)).toBe(25)
  })

  it('2. the minimum is reached when saved + elapsed hits it, not before', () => {
    const started = T0.toISOString()
    expect(isReached({ saved: 0, startedAt: started, now: after(39 * 60 + 59), minimum: 40 })).toBe(
      false,
    )
    expect(isReached({ saved: 0, startedAt: started, now: after(40 * 60), minimum: 40 })).toBe(true)
    expect(isReached({ saved: 25, startedAt: started, now: after(15 * 60), minimum: 40 })).toBe(
      true,
    )
    // Nothing running: only the saved minutes count.
    expect(isReached({ saved: 40, startedAt: null, now: T0, minimum: 40 })).toBe(true)
    expect(isReached({ saved: 25, startedAt: null, now: T0, minimum: 40 })).toBe(false)
  })

  it('the 240-minute cap applies to reaching the minimum too', () => {
    expect(
      isReached({ saved: 0, startedAt: T0.toISOString(), now: after(20 * 3600), minimum: 300 }),
    ).toBe(false)
  })

  it('a slot never holds more than 600 minutes', () => {
    expect(MAX_SLOT_MINUTES).toBe(600)
  })

  it('analytics buckets follow the epic: <15 / 15–30 / 30–60 / 60+', () => {
    expect(minutesBucket(5)).toBe('<15')
    expect(minutesBucket(14)).toBe('<15')
    expect(minutesBucket(15)).toBe('15–30')
    expect(minutesBucket(29)).toBe('15–30')
    expect(minutesBucket(30)).toBe('30–60')
    expect(minutesBucket(59)).toBe('30–60')
    expect(minutesBucket(60)).toBe('60+')
    expect(minutesBucket(600)).toBe('60+')
  })

  it('a day is done only when every slot of its template is completed (D-SP-7)', () => {
    const slots = [{ minutes: 20 }, { minutes: 40 }]
    expect(dayProgressOf(slots, [])).toBeUndefined()
    expect(
      dayProgressOf(slots, [
        { slotIndex: 0, minutes: 20, completed: true },
        { slotIndex: 1, minutes: 25, completed: false },
      ]),
    ).toEqual({ done: false, minutes: 45 })
    expect(
      dayProgressOf(slots, [
        { slotIndex: 0, minutes: 22, completed: true },
        { slotIndex: 1, minutes: 40, completed: true },
      ]),
    ).toEqual({ done: true, minutes: 62 })
    // A log of a slot the template no longer has does not make the day done.
    expect(dayProgressOf(slots, [{ slotIndex: 0, minutes: 20, completed: true }])).toEqual({
      done: false,
      minutes: 20,
    })
  })
})
