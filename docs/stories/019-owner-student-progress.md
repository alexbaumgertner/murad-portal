---
id: 019
title: Murad sees how each student is doing and what she wrote
status: done # draft | approved | in-progress | done
---

# 019 — Student progress for the owner

**As** Murad (owner)
**I want** one page on the site with every student's progress and her day comments
**so that** I can see before a lesson who is on track, who is behind and what was hard, without
putting rows of three admin lists side by side.

Epic: `study-programs-epic.md` (Roles: the owner "reads all progress and comments"). Story 016 gave
Murad the comments as an admin list; this story adds the per-student summary the student herself
sees on `/study`. Read-only: no new data, no migration, no change to collection access.

## Acceptance criteria

1. `[edge]` **Given** a signed-in student **when** she opens `/study/students` or a student's
   page **then** she sees the "page not found" screen and no one else's data; an anonymous visitor
   is sent to the sign-in page, which brings the owner back; the owner sees the page. (The HTTP
   status of that screen is 200, like every page under `/study`: `loading.tsx` streams it.)
2. `[happy]` **Given** students with an assigned, an active, a paused and a finished program
   **when** the owner opens `/ru/study/students` **then** each is listed with name, program and
   levels, status, "day X of N", days done, days missed, total minutes and the date of her last
   study day; an assigned program shows only its status.
3. `[happy]` **Given** a student **when** the owner opens her page **then** he sees the grid of the
   current program week and of the week before it with the same markers as hers (✓ ½ ✕ ‖ — ●,
   never colour alone), pauses included, and nothing in it is a link or a button.
4. `[happy]` **Given** a student who wrote comments **when** the owner opens her page **then** he
   sees the latest ones, newest first, each with its date and program day, line breaks kept.
5. `[edge]` **Given** no students (or a student with no comments, or one who has not started)
   **when** the owner opens the pages **then** each shows an empty state instead of a blank.
6. `[edge]` **Given** an unknown or someone else's id in the student URL **then** "not found".
7. `[happy]` **Given** the page **then** it changes nothing: reading it writes no slot log, no
   status and no comment, and the private note of a placement is never shown.
8. `[happy]` **Given** English or Russian **then** every text exists in `messages/ru.json` and
   `messages/en.json`; the page works at 360 px.

## Out of scope

- Answering a comment, marking it read, notifications.
- Editing anything from this page (plans are edited in `/admin`, «План ученика»).
- Filters and sorting, CSV export, charts.
- A link to the page in the site header (the header is static; the page is opened by its address).

## Verification

| #   | Test (file › name)                                                                                                         | Layer     |
| --- | -------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | `tests/e2e/owner-progress.e2e.spec.ts` › anonymous is sent to sign-in, a student gets «not found», the owner sees the page | e2e       |
| 1   | `tests/int/owner-progress.int.spec.ts` › refuses a user who is not the owner                                               | int       |
| 2   | `tests/unit/owner-progress.unit.spec.ts` › summarizes each status                                                          | unit      |
| 2   | `tests/int/owner-progress.int.spec.ts` › lists every student with her numbers                                              | int       |
| 3   | `tests/browser/DayGrid.browser.spec.tsx` › the owner’s grid … nothing to click                                             | browser   |
| 3   | `tests/int/owner-progress.int.spec.ts` › detail has the current and the previous week                                      | int       |
| 4   | `tests/int/owner-progress.int.spec.ts` › comments newest first with program day                                            | int       |
| 5   | `tests/e2e/owner-progress.e2e.spec.ts` › the list, a student’s page … empty states, 360 px                                 | e2e       |
| 5   | manual: no students at all shows «Пока нет учеников…» (the list is empty on a fresh database)                              | browser   |
| 6   | `tests/int/owner-progress.int.spec.ts` › unknown enrollment is not found                                                   | int       |
| 7   | `tests/int/owner-progress.int.spec.ts` › reading changes nothing                                                           | int       |
| 8   | `tests/unit/messages.unit.spec.ts` (existing key parity) · `owner-progress.e2e.spec.ts` › 360 px                           | unit, e2e |
