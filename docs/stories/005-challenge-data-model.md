---
id: 005
title: Murad sets up his 90-day challenge in the admin
status: approved
---

# 005 — Challenge data model, admin and progress maths

**As** Murad
**I want** to create my challenge (start date, six video topics) in the admin
**so that** the tracker knows the calendar, the blocks and the targets.

## Data model (needs a migration)

- `challenges`: `title` (localized), `slug` (unique), `startDate` (date), `timeZone` (IANA, default `Asia/Almaty`),
  `durationDays` (default 90), `dailyMinutes` (default 90), `blockDays` (default 15), `isPublic` (checkbox),
  `rules` (rich text, localized — the allowed / not allowed content list),
  `videos`: array of exactly `durationDays / blockDays` items `{ title, youtubeUrl?, publishedAt?, retroWorked?, retroDropped?, retroChange? }`.
- `challenge-days`: `challenge` (relationship), `dayNumber` (1…durationDays), `minutes` (1…600), `notes` (textarea, ≤ 500 chars), `closedAt`.
  Unique on (`challenge`, `dayNumber`).
- `src/features/challenge/progress.ts` — pure, framework-free functions (no `server-only`, no `next/*`):
  `dayNumberOn(date, startDate, timeZone)`, `blockOf(dayNumber, blockDays)`, `endsAt(...)`,
  `summarize(challenge, days, now)` → `{ todayNumber, minutesDone, minutesTarget, sessionsDone, sessionsPlanned, videosPublished, videosTarget, daysLeft, status: 'not-started' | 'running' | 'finished' }`.

## Acceptance criteria

1. `[happy]` **Given** Murad is signed in **when** he creates a challenge with a start date and six video titles **then** it is saved with defaults 90 / 90 / 15 and a target of 8 100 minutes.
2. `[edge]` **Given** `durationDays` not divisible by `blockDays`, or a `videos` count different from `durationDays / blockDays` **when** saving **then** validation rejects it with a clear message.
3. `[happy]` **Given** start date 2026-10-07 in `Asia/Almaty` **when** it is 2026-10-07 23:30 in Astana (18:30 UTC) **then** `todayNumber` is 1; at 2026-10-08 00:10 Astana it is 2.
4. `[happy]` **Given** days 1–20 **when** mapping to blocks **then** days 1–15 are block 1 and day 16 is block 2.
5. `[happy]` **Given** 3 closed days of 90 minutes on day 4 **when** summarizing **then** minutesDone = 270 of 8 100, sessionsDone = 3, sessionsPlanned = 4.
6. `[edge]` **Given** days logged above 90 minutes **when** summarizing **then** minutesDone is the real sum (may exceed the daily target); percentages are capped at 100 % for display only.
7. `[edge]` **Given** `now` before the start / after the end **when** summarizing **then** status is `not-started` / `finished`, `daysLeft` is never negative, sessionsPlanned is 0 / durationDays.
8. `[edge]` **Given** an anonymous API client **when** it reads a non-public challenge or its days, or writes anything **then** it is refused; a public challenge and its days are readable.
9. `[edge]` **Given** a second `challenge-days` row for the same challenge and day **when** saving **then** it is rejected.

## Out of scope

- Public page (006), closing days from the site (007), video retro UI (008).
- Multiple owners or learner challenges.

## Verification

| #   | Test (file › name)                  | Layer |
| --- | ----------------------------------- | ----- |
|     | filled in during step 3 of /feature |       |
