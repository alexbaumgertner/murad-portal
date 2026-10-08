---
id: 005
title: Murad sets up his 90-day challenge in the admin
status: done
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

| #   | Test (file › name)                                                                                                                                                                          | Layer |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | `challenge.int.spec.ts` › data model › saves a challenge with the defaults 90 / 90 / 15 and an 8 100-minute target                                                                          | int   |
| 2   | `challenge.int.spec.ts` › rejects a durationDays that is not divisible by blockDays · rejects a videos count different from durationDays / blockDays · re-checks the shape on update        | int   |
| 2   | `challenge-progress.unit.spec.ts` › checkChallengeShape › (divisible / videos count / non-integer cases)                                                                                    | unit  |
| 3   | `challenge-progress.unit.spec.ts` › dayNumberOn › is day 1 at 23:30 Astana … (18:30 UTC) · is day 2 at 00:10 Astana … (19:10 UTC) · is still day 1 at 23:59:59 and day 2 at 00:00:00 Astana | unit  |
| 4   | `challenge-progress.unit.spec.ts` › blockOf › maps days 1–15 to block 1 and day 16 to block 2                                                                                               | unit  |
| 5   | `challenge-progress.unit.spec.ts` › summarize › counts minutes, sessions and the 8 100-minute target on day 4                                                                               | unit  |
| 6   | `challenge-progress.unit.spec.ts` › summarize › reports the real minutes when days exceed the daily target · percent › caps at 100 for display while the real value stays above             | unit  |
| 7   | `challenge-progress.unit.spec.ts` › summarize › is not-started before the start date · is finished after the end, with no negative days left · is still running on day 90 …                 | unit  |
| 8   | `challenge.int.spec.ts` › access › (anonymous reads see public challenges and their days only · hides a non-public challenge from findByID · refuses anonymous writes on both collections)  | int   |
| 9   | `challenge.int.spec.ts` › challenge days › rejects a second row for the same challenge and day (plus the unique index `challenge_dayNumber_idx` in the migration)                           | int   |

Also covered: day/minutes/notes bounds and a signed-in admin seeing private rows (`challenge.int.spec.ts`), DST-safe day counting and `endsAt` (`challenge-progress.unit.spec.ts`).
No browser flow in this story (admin only), so no e2e test was added.
