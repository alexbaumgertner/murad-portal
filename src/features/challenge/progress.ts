// Pure progress maths for a challenge. No framework imports (no `server-only`, no `next/*`):
// it runs in Server Components, client components, scripts and unit tests.
//
// Conventions
// - `startDate` is a calendar date. Payload's day-only picker stores it at noon UTC, so only the
//   `YYYY-MM-DD` part is used; it is never shifted into another time zone.
// - "Today" is the calendar date of `now` in the challenge's IANA `timeZone` (Asia/Almaty by default),
//   so a day flips at local midnight, not at UTC midnight.
// - Only closed days (`closedAt` set) count towards minutes and sessions.

const DAY_MS = 86_400_000

export type ChallengeShape = {
  startDate: string
  timeZone: string
  durationDays: number
  dailyMinutes: number
  blockDays: number
  videos?: ReadonlyArray<{ publishedAt?: string | null }> | null
}

export type DayRecord = {
  dayNumber: number
  minutes: number
  closedAt?: string | null
}

export type ChallengeStatus = 'not-started' | 'running' | 'finished'

export type ChallengeSummary = {
  /** 1…durationDays while running, `null` before the start and after the end. */
  todayNumber: number | null
  minutesDone: number
  minutesTarget: number
  sessionsDone: number
  sessionsPlanned: number
  videosPublished: number
  videosTarget: number
  /** Whole days still ahead, today included while running; 0 once finished. */
  daysLeft: number
  status: ChallengeStatus
}

type Civil = { year: number; month: number; day: number }

function civilFromIso(value: string): Civil {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) throw new RangeError(`Invalid start date: ${value}`)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

function dayIndex({ year, month, day }: Civil): number {
  return Date.UTC(year, month - 1, day) / DAY_MS
}

function civilFromIndex(index: number): Civil {
  const d = new Date(index * DAY_MS)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

function zonedParts(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(ms))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** Offset of `timeZone` from UTC at the instant `ms`, in milliseconds (east is positive). */
function offsetMs(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(ms / 1000) * 1000
}

/** The instant at which `civil` starts (00:00) in `timeZone`. */
function startOfCivilDay(civil: Civil, timeZone: string): Date {
  const naive = Date.UTC(civil.year, civil.month - 1, civil.day)
  let instant = naive - offsetMs(naive, timeZone)
  // The offset can differ at the corrected instant (DST change that day): settle once more.
  const corrected = naive - offsetMs(instant, timeZone)
  if (corrected !== instant) instant = corrected
  return new Date(instant)
}

/** 1-based day of the challenge that `date` falls on; 0 or negative before the start, > duration after. */
export function dayNumberOn(date: Date, startDate: string, timeZone: string): number {
  const p = zonedParts(date.getTime(), timeZone)
  const today = dayIndex({ year: p.year, month: p.month, day: p.day })
  return today - dayIndex(civilFromIso(startDate)) + 1
}

/** 1-based block (video) a day belongs to: days 1–15 → 1, day 16 → 2 (for blockDays = 15). */
export function blockOf(dayNumber: number, blockDays: number): number {
  return Math.ceil(dayNumber / blockDays)
}

/** The instant the challenge ends: local midnight after the last day. */
export function endsAt(
  challenge: Pick<ChallengeShape, 'startDate' | 'timeZone' | 'durationDays'>,
): Date {
  const endIndex = dayIndex(civilFromIso(challenge.startDate)) + challenge.durationDays
  return startOfCivilDay(civilFromIndex(endIndex), challenge.timeZone)
}

/** Share of `done` in `target` as a whole percent, capped at 100 for display. */
export function percent(done: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((done / target) * 100)))
}

export function summarize(
  challenge: ChallengeShape,
  days: ReadonlyArray<DayRecord>,
  now: Date,
): ChallengeSummary {
  const { durationDays, dailyMinutes, blockDays } = challenge
  const rawToday = dayNumberOn(now, challenge.startDate, challenge.timeZone)

  const status: ChallengeStatus =
    rawToday < 1 ? 'not-started' : rawToday > durationDays ? 'finished' : 'running'

  const closedDays = days.filter(
    (d) => d.closedAt && d.dayNumber >= 1 && d.dayNumber <= durationDays,
  )
  const videos = challenge.videos ?? []

  return {
    todayNumber: status === 'running' ? rawToday : null,
    minutesDone: closedDays.reduce((sum, d) => sum + d.minutes, 0),
    minutesTarget: durationDays * dailyMinutes,
    sessionsDone: closedDays.length,
    sessionsPlanned: status === 'not-started' ? 0 : Math.min(rawToday, durationDays),
    videosPublished: videos.filter(
      (v) => v.publishedAt && new Date(v.publishedAt).getTime() <= now.getTime(),
    ).length,
    videosTarget: Math.floor(durationDays / blockDays),
    daysLeft:
      status === 'not-started'
        ? durationDays
        : status === 'finished'
          ? 0
          : durationDays - rawToday + 1,
    status,
  }
}
