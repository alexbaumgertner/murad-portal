---
id: 030
title: Murad sees all his students and their planners on one page and knows who needs help
status: done
---

# 030 — Owner dashboard: students × planners

**As** Murad (owner)
**I want** one page listing every student with the state of her planner
**so that** I see who is active, who has no planner, how far each one is and who needs my help,
and open the right planner in one click instead of digging through 20 Payload collections.

Epic: `weekly-planner-epic.md`. The planner is the main feature for students, so it leads this page; the
program summary of story 019 (status, day X of N) is shown in the same row when the student has an
enrollment. Today's `/study/students` lists enrollments only; this story makes it list **students**
(users with role `student`), so a student with a planner but no program, or with neither, is not lost.
Read-only: no new collection, no migration, no access change. Creating a planner and copying weeks
are story 031.

## Decisions taken (owner, Oct 15, 2026)

- "Needs help" = one of three signals (below). Starting thresholds are constants in `shape.ts`, easy to tune.
- Planner and program students are the same people: one table, one row per student.

## Row contents

| Column          | Source                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Name (or email) | `users`                                                                                                       |
| Planner         | none / current week number («неделя 3») and its dates                                                         |
| Week progress   | done / written tasks of the current week + bar (`weekStats`, `percentOf` from `features/planner/progress.ts`) |
| Last tick       | date of the most recent `done` cell of her planner (`updatedAt` of the latest done cell)                      |
| Program         | status and «day X of N» from 019, or «—»                                                                      |
| Signals         | chips, each with text (never colour alone)                                                                    |
| Action          | «Open planner» → `/study/planner?student=ID`                                                                  |

"Current week" = the planner week that contains today (UTC-noon calendar days, like the planner). If today
is before `baseDate` or after the last existing week, there is no current week.

## Signals ("needs help")

1. `noPlanner` — the student has no planner.
2. `noTasks` — a planner exists but its current week has no written task (or no current week).
3. `idle` — the current week has written tasks dated up to today and no tick in the last 3 days
   (`IDLE_DAYS = 3`). Does not fire on a week whose tasks all start in the future.
4. `questions` — the current week has at least one non-empty «Questions» diary note. (There is no
   "answered" state yet, so it stays on all week; see out of scope.)

A student "needs help" when she has any of 2–4. Signal 1 is shown but is its own filter ("Without planner"):
a student with no planner has not been given anything to be helped with yet.

## Acceptance criteria

1. `[edge]` **Given** an anonymous visitor, a signed-in student, or the owner **when** they open
   `/study/students` **then** anonymous is sent to sign-in (which returns here), a student gets the
   "not found" screen and no one else's data, the owner sees the page. The query refuses a non-owner.
2. `[happy]` **Given** students with a planner and a program, a planner only, a program only, and
   neither **when** the owner opens the page **then** each appears exactly once with the columns above;
   missing parts show «—» and the `noPlanner` chip where it applies.
3. `[happy]` **Given** a planner whose current week has 8 written tasks and 3 ticked **then** the row
   shows «3 / 8», 38 % and a bar; a week with 0 written tasks shows «—», never 0 % or 100 %
   (`percentOf` returns `null`). Empty tasks (`-`, `—`, whitespace) are not counted.
4. `[happy]` **Given** the signals **then** `noTasks`, `idle` and `questions` fire exactly as defined
   above, including the boundaries: tick exactly 3 days ago is idle, 2 days ago is not; a week whose
   tasks are all after today is not idle; a past or future week's notes do not trigger `questions`.
5. `[happy]` **Given** the filters «All», «Need help», «Without planner», «Active» **when** the owner
   picks one **then** only matching rows are shown with the count; the choice is in the URL
   (`?filter=help`), so reload and back keep it. An unknown value falls back to «All».
   "Active" = has a planner, or an active program.
6. `[happy]` **Given** the list **then** the default order is: needs help first, then by oldest last
   tick, then without planner, then by name; sort is stable and uses the page locale for names.
7. `[happy]` **Given** a row **when** the owner clicks «Open planner» **then** he lands on
   `/study/planner?student=ID`; a student without a planner links to the same page (its create button is
   story 031) and a student with a program keeps the 019 link to her program page.
8. `[edge]` **Given** no students **then** an empty state, not a blank; **given** a filter with no
   match **then** a "nobody matches" state with a "show all" link.
9. `[edge]` **Given** 35 students **then** the page is one query per collection (no N+1), and the
   private note of a placement and all students' appearance JSON are never read.
10. `[happy]` **Given** the page **then** it changes nothing: no write, no `track()`, no log.
11. `[ui]` **Given** ru and en and a 360 px screen **then** every text exists in both `messages` files,
    the table becomes cards without horizontal page scroll, filters stay reachable, and every status
    and signal has a text label.

## Out of scope

- Creating a planner from the list, copying a week or a template (story 031).
- Marking a question as answered, replies, notifications, e-mail digests.
- Charts, CSV export, bulk actions.
- Changing the `/study/students/[id]` page of 019 (its grid and comments stay).
- A header link (the page is opened by address, as in 019).

## Notes for implementation

- Pure function `summarizePlanners(...)` in `src/features/owner-progress/planner-shape.ts`
  (week-of-today, signals, ordering, filter parsing), unit-tested with an injected `now`.
- Query in `owner-progress/queries.ts`: `users` (role student) + `planners` + `planner-weeks` +
  `planner-cells` + `planner-notes` for the **current weeks only**, each read as the owner with
  `overrideAccess: false`, `select` only the needed fields, then joined in memory.
- Reuses 019 summaries by student id; the existing page becomes this one (keep the route).
- No migration, no `generate:types`. New copy under `OwnerProgress` in both `messages` files.
- `docs/baseline.md` and `docs/decisions.md` (signal thresholds) updated.

## Verification

| #   | Test (file › name)                                                                                     | Layer     |
| --- | ------------------------------------------------------------------------------------------------------ | --------- |
| 1   | `tests/e2e/owner-dashboard.e2e.spec.ts` › anonymous → sign-in, student → not found, owner sees it      | e2e       |
| 1   | `tests/int/owner-dashboard.int.spec.ts` › refuses a user who is not the owner                          | int       |
| 2   | `tests/int/owner-dashboard.int.spec.ts` › one row per student across the four combinations             | int       |
| 3   | `tests/unit/owner-dashboard.unit.spec.ts` › week progress counts written tasks only, null when none    | unit      |
| 4   | `tests/unit/owner-dashboard.unit.spec.ts` › signal boundaries (3 days, future week, other weeks)       | unit      |
| 5   | `tests/unit/owner-dashboard.unit.spec.ts` › filters and unknown value                                  | unit      |
| 5   | `tests/e2e/owner-dashboard.e2e.spec.ts` › filter lives in the URL                                      | e2e       |
| 6   | `tests/unit/owner-dashboard.unit.spec.ts` › ordering                                                   | unit      |
| 7   | `tests/e2e/owner-dashboard.e2e.spec.ts` › «Open planner» opens the student's planner                   | e2e       |
| 8   | `tests/e2e/owner-dashboard.e2e.spec.ts` › empty and no-match states                                    | e2e       |
| 9   | `tests/int/owner-dashboard.int.spec.ts` › query count does not grow with students; no placement read   | int       |
| 10  | `tests/int/owner-dashboard.int.spec.ts` › reading changes nothing                                      | int       |
| 11  | `tests/unit/messages.unit.spec.ts` (key parity) · `owner-dashboard.e2e.spec.ts` › 360 px, both locales | unit, e2e |
