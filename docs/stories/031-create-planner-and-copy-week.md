---
id: 031
title: Murad creates a planner from the student list and copies a week in one click
status: approved
---

# 031 — Create a planner from the dashboard, copy a week

**As** Murad (owner)
**I want** to create a student's planner right from the dashboard and to duplicate a finished week
**so that** I do not retype similar tasks every week for 20–35 students.

Epic: `weekly-planner-epic.md`; follows story 030 (the dashboard). Approved by the owner in chat on
Oct 15, 2026 ("start 031"). No migration, no collection change.

## Acceptance criteria

1. `[happy]` **Given** a student without a planner **when** the owner presses «Создать планнер» in her
   dashboard row **then** the planner is created with the Monday of this week as the first Monday, one
   week and one empty row, the row refreshes to show the planner state, and a failure is shown as a
   translated message (the server returns a code).
2. `[edge]` **Given** a student who already has a planner **then** the row has no create button and the
   server refuses a second planner (`exists`), also on a double click.
3. `[happy]` **Given** a week with tasks **when** the owner presses «Копировать неделю» **then** a new
   week is appended after the highest index (gaps stay), with the same number of rows and the same task
   texts in the same cells, nothing ticked, and no diary notes; the source week is unchanged.
4. `[edge]` **Given** a week whose cells are empty **then** the copy is an empty week with the same
   number of rows.
5. `[access]` **Given** a student, an anonymous caller or an unknown week id **when** the copy is
   requested **then** it is refused (`forbidden` / `unauthorized` / `not_found`) and nothing is created.
6. `[edge]` **Given** the highest allowed week index is already used **then** the copy is refused with
   the code `too_many_weeks`, not a crash.
7. `[ui]` **Given** ru and en and 360 px **then** the new texts exist in both `messages` files and the
   buttons do not overflow; the copy button is disabled while the request runs.

## Out of scope

- Choosing the target week or a start date; a copy always goes to the end.
- Copying ticks, diary notes, appearance or a whole planner between students.
- Templates / default plans for planners.

## Verification

| #   | Test (file › name)                                                                              | Layer |
| --- | ----------------------------------------------------------------------------------------------- | ----- |
| 1   | `tests/e2e/owner-dashboard.e2e.spec.ts` › create a planner from the list, then copy a week      | e2e   |
| 2   | `tests/int/planner-copy.int.spec.ts` › a second planner is refused                              | int   |
| 3   | `tests/int/planner-copy.int.spec.ts` › copies rows and texts, not ticks or notes                | int   |
| 4   | `tests/int/planner-copy.int.spec.ts` › an empty week copies to an empty week                    | int   |
| 5   | `tests/int/planner-copy.int.spec.ts` › a student and an unknown week are refused                | int   |
| 6   | `tests/int/planner-copy.int.spec.ts` › refuses when the last week index is taken                | int   |
| 7   | `tests/unit/messages.unit.spec.ts` (key parity) · `owner-dashboard.e2e.spec.ts` › 360 px        | unit, e2e |
