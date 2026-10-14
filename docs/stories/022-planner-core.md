---
id: 022
title: Murad plans a student's week as a grid and the student ticks tasks
status: in-progress
---

# 022 — Planner core

**As the** owner **I want** a weekly grid (priority rows × Monday–Sunday) per student **so that** I give her a clear plan.
**As a** student **I want** to open my week and tick finished tasks **so that** Murad and I see what is done.

## Acceptance criteria

1. `[happy]` **Given** a student without a planner **when** the owner creates one and sets the first Monday **then** it has week 1 with one empty row and no tasks, name and goal are empty.
2. `[happy]` **Given** a base date that is not a Monday **then** it is normalized to that week's Monday and the real Monday is shown.
3. `[happy]` **Given** week N **then** its columns show Monday…Sunday dates = base + 7N + d days, correct over month, year and leap-year boundaries and DST changes (e.g. base 2026-12-28 → week 2 starts 2027-01-04).
4. `[happy]` **Given** the owner clicks «Add week» **then** a new week gets exactly one empty row, whatever the other weeks have; weeks keep independent rows, tasks, ticks.
5. `[happy]` **Given** «+ Add priority» **then** one blank row is appended to the current week only; labels are Roman numerals, correct for 1…40 (IV, IX, XL…).
6. `[happy]` **Given** «− Remove priority» **when** confirmed **then** the last row and its tasks and ticks are deleted; cancelled → nothing changes.
7. `[edge]` **Given** a week with one row **then** «Remove priority» is disabled (min 1) and the server refuses too.
8. `[happy]` **Given** the owner deletes a week after a confirmation naming the data loss **then** it is removed; other weeks keep their index and dates (a gap remains; the week list skips it; «Add week» appends after the highest index; 4-week groups use `floor(index/4)`).
9. `[happy]` **Given** a task text **when** the owner types it **then** it saves (blur / Enter), is shown as plain text (HTML is not executed), wraps instead of breaking the grid.
10. `[edge]` **Given** empty, whitespace, `-`, `–`, `—` **then** the cell is «no task»: cannot be ticked; clearing the text clears the tick.
11. `[happy]` **Given** a task **when** the student presses its tick (button, keyboard-operable, `aria-pressed`) **then** `done` toggles and the cell turns the done color; typing in the cell never toggles it.
12. `[access]` **Given** a student **then** she reads only her planner, can change only `done` (and nothing else) — 403 otherwise; anonymous reads nothing; another student's planner is 404.
13. `[edge]` **Given** a text over 500 chars or a 41st row **then** a code error (`textTooLong`, `tooManyRows`), no sentences from the server.
14. `[edge]` **Given** a double click on the tick **then** the final state matches the last click (no lost update).
15. `[happy]` **Given** 360 px width **then** the grid scrolls horizontally inside its container; weekday names stay readable.

## Out of scope

Labels/diary/print (023), progress (024), appearance (025–027), backup (028).

## Notes

- Pure helpers in `src/features/planner/dates.ts`, `roman.ts`, `task.ts` (`isAssignedTask`), unit-tested.
- Server Actions → Zod → `service.ts`; `monitorAction`; `track('planner_task_ticked')` after success (add to the analytics catalog). No emails or ids in props.
- Migration required; `pnpm generate:types`.

## Verification

| # | Test | Layer |
| --- | --- | --- |
| 2,3 | `planner-dates.unit.spec.ts` | unit |
| 5 | `planner-roman.unit.spec.ts` (1…40) | unit |
| 10 | `planner-task.unit.spec.ts` | unit |
| 1,4,6,7,8,12,13,14 | `planner.int.spec.ts` | int |
| 9,11,15 | `PlannerGrid.browser.spec.tsx` | browser |
| 1,11 | `planner.e2e.spec.ts` (desktop + mobile) | e2e |
