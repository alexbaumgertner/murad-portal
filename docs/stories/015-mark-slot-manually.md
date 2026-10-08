---
id: 015
title: Student marks a slot done manually, including past days
status: approved
---

# 015 — Mark a slot manually, including past days

**As a** student
**I want** to mark an activity done without the timer and fix past days
**so that** my history is honest even when I studied offline.

## Data model
- Uses `slot-logs` from 014; no new fields.

## Acceptance criteria
1. `[happy]` **Given** a slot of today or a past day **when** the student taps «Отметить вручную», enters 30 and saves **then** minutes = 30 and completed = (30 ≥ minimum).
2. `[happy]` **Given** a past day marked ✕ **when** all its slots are marked done **then** the cell changes to ✓; partly — to ½.
3. `[edge]` **Given** an already saved log **when** marking again **then** the record is updated, not duplicated.
4. `[edge]` **Given** minutes 0 **then** the slot is reset to not done; minutes 601 **then** «Не больше 600 минут».
5. `[edge]` **Given** a future day or a day before startDate **then** the controls are hidden and the API returns 403.
6. `[edge]` **Given** a day inside a pause (017) **then** marking is not available.
7. `[edge]` **Given** a running timer on that slot **when** marking manually **then** the timer is stopped first and the manual value replaces the total.

## Analytics
- `slot_completed` {slotTypeId, minutesBucket, viaTimer: false}.

## Out of scope
- Editing other students' data, owner editing student logs.

## Notes
- Depends on 014. Same rules as challenge story 007 (past yes, future no, repeat = update).
