---
id: 009
title: The tracker knows which day it is and how far Murad has come
status: draft
depends_on: [] # pure functions over plain inputs; no schema
runs: parallel # can run alongside 005
---

# 009 — Challenge calendar and progress maths

**As** Murad (and every visitor of the tracker)
**I want** "today", the blocks and the totals computed the same way everywhere
**so that** the grid, the bars and the "close a day" rules never disagree.

## Shape

`src/features/challenge/progress.ts` — pure and framework-free (no `server-only`, no `next/*`, no Payload imports,
no date library: `Intl.DateTimeFormat` only). Inputs are plain types declared in the file, not `payload-types`:

```ts
type ChallengeInput = { startDate: string; timeZone: string; durationDays: number; dailyMinutes: number; blockDays: number }
type DayInput = { dayNumber: number; minutes: number }
type VideoInput = { blockNumber: number; publishedAt?: string | null }
```

- `dayNumberOn(now, challenge)` → integer, may be ≤ 0 (before start) or > `durationDays` (after end).
- `blockOf(dayNumber, blockDays)` → 1-based block.
- `dateOfDay(dayNumber, challenge)` → `YYYY-MM-DD` in the challenge time zone.
- `cellState(dayNumber, todayNumber, closedDays)` → `'closed' | 'today' | 'missed' | 'future'`.
- `summarize(challenge, days, videos, now)` → `{ todayNumber, minutesDone, minutesTarget, sessionsDone,
  sessionsPlanned, videosPublished, videosTarget, daysLeft, status: 'not-started' | 'running' | 'finished' }`.

## Acceptance criteria

1. `[happy]` **Given** start date 2026-10-07 in `Asia/Almaty` **when** it is 2026-10-07 23:30 Astana (18:30 UTC) **then** `todayNumber` is 1; at 2026-10-08 00:10 Astana (2026-10-07 19:10 UTC) it is 2.
2. `[happy]` **Given** days 1–20 and `blockDays` 15 **when** mapping to blocks **then** days 1–15 are block 1 and day 16 is block 2.
3. `[happy]` **Given** defaults **when** summarizing **then** `minutesTarget` is 8 100 and `videosTarget` is 6.
4. `[happy]` **Given** 3 closed days of 90 minutes and today is day 4 **when** summarizing **then** `minutesDone` = 270, `sessionsDone` = 3, `sessionsPlanned` = 4 (today counts as planned).
5. `[edge]` **Given** days logged above 90 minutes **when** summarizing **then** `minutesDone` is the real sum; percentages are not computed here (display caps at 100 %).
6. `[edge]` **Given** `now` before the start / after the end **when** summarizing **then** status is `not-started` / `finished`, `daysLeft` is never negative, `sessionsPlanned` is 0 / `durationDays`.
7. `[edge]` **Given** videos with `publishedAt` outside their block or after the end **when** summarizing **then** they still count as published.
8. `[edge]` **Given** a challenge time zone ahead of / behind UTC **when** `now` is just around local midnight **then** `dayNumberOn` follows the challenge's local date, not the server's or UTC.

## Out of scope

- Reading from Payload (that is `queries.ts` in 006). Rendering.

## Verification

| #   | Test (file › name)                  | Layer |
| --- | ----------------------------------- | ----- |
|     | filled in during step 3 of /feature | unit  |
