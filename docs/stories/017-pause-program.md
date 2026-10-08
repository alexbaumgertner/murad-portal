---
id: 017
title: Student pauses and resumes a program
status: draft
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
