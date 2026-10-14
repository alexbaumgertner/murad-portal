---
id: 029
title: The student picks task types that Murad prepared
status: done
---

# 029 — Task types

**As the** owner **I want** a list of task types per planner **so that** the student fills her priorities from it.
**As a** student **I want** to pick a task type in a cell **so that** I plan my week without typing.

## Acceptance criteria

1. `[happy]` **Given** the owner's panel «Task types» **when** she saves one type per line **then** the list is stored trimmed, without blanks and repeats (max 30 types, 80 chars each).
2. `[happy]` **Given** a non-empty list **then** a student's cell is a drop-down of the types (plus an empty choice); picking one saves it and the tick appears.
3. `[edge]` **Given** a student **when** she sends a text that is not in the list **then** `forbidden`; an empty text clears the cell.
4. `[happy]` **Given** the owner **then** she still types any text in a cell.
5. `[edge]` **Given** an empty list **then** the student sees plain text, no drop-down.
6. `[access]` **Given** a student **then** she cannot save the list.

## Out of scope

- Including the list in the backup file (the planner's own task types stay on the planner).

## Verification

| #       | Test (file › name)                                                     | Layer   |
| ------- | ---------------------------------------------------------------------- | ------- |
| 1,3,4,6 | `tests/int/planner.int.spec.ts` › `029. the owner sets task types…`    | int     |
| 2       | `tests/browser/PlannerGrid.browser.spec.tsx` › `029. a student picks…` | browser |
