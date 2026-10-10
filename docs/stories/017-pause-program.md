---
id: 017
title: Student pauses and resumes a program
status: done
---

# 017 — Pause and resume

**As a** student
**I want** to pause my program for a holiday or illness
**so that** those days don't count as missed and the plan continues where I stopped.

## Data model

- Uses `enrollments.status` and `enrollments.pauses` from 012. A pause: `from` date (first paused day), `to` date nullable (last paused day; null while paused).

## Acceptance criteria

1. `[happy]` **Given** an active enrollment on program day 20 **when** the student presses «Пауза» and confirms **then** status = paused, a pause starts today, `/study` shows «На паузе с 12 окт · День 20 из 364» and «Продолжить».
2. `[happy]` **Given** a pause of 5 days **when** «Продолжить» **then** status = active, the pause closes with `to` = yesterday, and today is program day 20 again (paused days are not counted).
3. `[happy]` **Given** the week grid **then** paused calendar days show the ‖ marker and are not counted as missed.
4. `[edge]` **Given** a pause of any length (e.g. 200 days) and any number of earlier pauses **when** «Продолжить» **then** it resumes normally; there is no limit and no auto-resume (Q6).
5. `[edge]` **Given** a running timer **when** pausing **then** the timer is stopped and saved first.
6. `[edge]` **Given** pause and resume on the same day **then** no pause record is kept and the day counts normally.
7. `[edge]` **Given** a paused enrollment **when** trying to start a timer or mark a slot **then** controls are hidden; API 409.
8. `[edge]` **Given** program day calculation with two pauses **then** unit tests cover: day before/after each pause, pause across a week boundary, pause on the last program day.

## Analytics

- `program_paused`, `program_resumed` {programSlug}.

## Out of scope

- Planned future pauses, owner pausing for a student, abandoning a program.

## Notes

- Depends on 013, 014. Updates the shared day-calculation helper.

## Verification

| #   | Test (file › name)                                                                                                                                      | Layer   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | `pause.int.spec.ts` › 1. a pause starts today: status paused, the program day stays …                                                                   | int     |
| 1   | `PauseProgram.browser.spec.tsx` › 1. «Пауза» asks first, then pauses and refreshes the page · «Отмена» · loading · error                                | browser |
| 1   | `pause.e2e.spec.ts` › 1/3/7. pause on day 10: «На паузе с … · День 10 из 56», ‖ in the grid, no timer                                                   | e2e     |
| 2   | `pause.int.spec.ts` › 2. a pause of 5 days ends yesterday and today is program day 20 again                                                             | int     |
| 2   | `pause-shape.unit.spec.ts` › is the same number again on the day after a pause of three days (AC 2)                                                     | unit    |
| 2   | `pause.e2e.spec.ts` › 1/3/7 … («Продолжить» ends the pause yesterday, day 10 again)                                                                     | e2e     |
| 3   | `pause-shape.unit.spec.ts` › weekGrid (AC 3): paused calendar days, not missed · `progressTotals`: a paused stretch is not missed                       | unit    |
| 3   | `pause.e2e.spec.ts` › 1/3/7 … (‖ cells named «пауза», not links)                                                                                        | e2e     |
| 4   | `pause.int.spec.ts` › 4. any length, any number of earlier pauses: 200 days resume normally                                                             | int     |
| 4   | `pause-shape.unit.spec.ts` › stands still while a pause is open, however long (AC 4: 200 days)                                                          | unit    |
| 4   | `pause.e2e.spec.ts` › 4. a pause of 200 days resumes normally                                                                                           | e2e     |
| 5   | `pause.int.spec.ts` › 5. a running timer is stopped and saved first                                                                                     | int     |
| 6   | `pause.int.spec.ts` › 6. pause and resume on the same day leave no record … · an earlier pause stays …                                                  | int     |
| 6   | `pause.e2e.spec.ts` › 6. pause and resume on the same day leave no pause                                                                                | e2e     |
| 7   | `pause.int.spec.ts` › 7. a paused program starts no timer and shows no slots to run · marking under pauses › a paused program marks nothing             | int     |
| 7   | `pause.e2e.spec.ts` › 1/3/7 … (no «Старт», no «Пауза» while paused)                                                                                     | e2e     |
| 8   | `pause-shape.unit.spec.ts` › programDay (AC 2, 4, 8): before/after each of two pauses, across a week boundary · the last program day (AC 8)             | unit    |
| —   | `pause.int.spec.ts` › finishing: a paused program is never closed; the pause-aware day, not the calendar, closes an active one                          | int     |
| —   | `pause.int.spec.ts` › days inside a pause: comments refused · marking under pauses: stored on the right calendar date                                   | int     |
| —   | `pause.int.spec.ts` › only the student, only through the server: direct API writes → 403, trusted transition whitelist, actions take nothing, analytics | int     |

Notes: AC 7's «API 409» is the `paused` error code of the Server Actions (there is no HTTP route for timers). Work logged on the day a pause begins counts toward that program day's totals, but the resume-day timer starts from 0 (follow-up).
