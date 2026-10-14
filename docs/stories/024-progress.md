---
id: 024
title: Progress of the week, of every four weeks and of the exam deadline
status: in-progress
---

# 024 — Progress

**As the** owner or student **I want** honest percentages **so that** I see real progress, not an artefact of empty cells.

## Acceptance criteria

1. `[happy]` **Given** a week **then** progress = done non-empty tasks / non-empty tasks × 100; empty cells and `-`/`—` are not counted.
2. `[edge]` **Given** a week without tasks **then** «—» / «No tasks», never 100%.
3. `[happy]` **Given** 1 task done → 100%; add a second undone → 50%; delete it → 100%; 4 tasks, 3 done → 75%; 10 tasks, 0 done → 0%. The strip updates immediately on add, delete, tick, untick, row removal.
4. `[happy]` **Given** weeks 1–4 / 5–8 … **then** one bar per existing group with a heading `WEEKS 01–04`, dates `OCT 12 – NOV 8, 2026` (cross-month and cross-year correct), a partial last group is shown.
5. `[happy]` **Given** week 1: 1 task done, week 2: 9 undone **then** the group shows 10%, not 50% (weighted by tasks).
6. `[edge]` **Given** a group with no tasks **then** a neutral empty state.
7. `[happy]` **Given** a deadline date **then** only tasks dated ≤ deadline count: deadline Nov 15 → Nov 14 and 15 count, Nov 16 does not; percent = done eligible / eligible.
8. `[happy]` **Given** the deadline block **then** it shows title, date, `67 DAYS LEFT` (calendar-day difference in the student's timezone, not hours), percent; past date → `OVERDUE`; today → `TODAY`.
9. `[edge]` **Given** no eligible tasks **then** an empty state, no percent.
10. `[happy]` **Given** the toggles (week default **on**, 4-week **off**, deadline **off**) **then** the owner can switch each; hidden blocks render nothing.
11. `[edge]` **Given** an invalid deadline date **then** `invalidDate`.

## Out of scope

Bar animation and colors (027).

## Notes

Settings (toggles, deadline title/date) are fields of `planners`, written by the owner only (`saveProgressSettingsAction`). All math in `src/features/planner/progress.ts` — pure, no `payload`, unit-tested first. Deadline "today" uses the student's `enrollment.timezone` if she has one, else `Asia/Almaty` (project default).

## Verification

| #      | Test                                                                            | Layer   |
| ------ | ------------------------------------------------------------------------------- | ------- |
| 1–9,11 | `planner-progress.unit.spec.ts` (acceptance scenarios D, E, F, G of the prompt) | unit    |
| 10     | `PlannerProgress.browser.spec.tsx`                                              | browser |
| 3,5    | `planner.e2e.spec.ts` › progress                                                | e2e     |
