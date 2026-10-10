---
id: 015
title: Student marks a slot done manually, including past days
status: done
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
- No collection change and no migration: reuses `slot-logs`. The write is the Server Action `markSlotAction` (Zod → `markSlot`): the browser sends only the program day, the slot and the minutes.
- AC 6: pause days (017) do not exist yet. Until then a paused enrollment is refused as a whole; 017 should also make `markSlot` and the past-day controls refuse the days inside a pause.
- Past days can be marked from the grid of the current week (`?day=N`); older weeks on `/study/weeks` stay read-only (follow-up).

## Verification

| #   | Test (file › name)                                                                                                                                                  | Layer   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | `mark-slot.int.spec.ts` › 1. 30 minutes on a past slot: minutes = 30, completed = (30 ≥ minimum) · 1b. today works too                                              | int     |
| 1   | `SlotTimers.browser.spec.tsx` › 015. «Отметить вручную» sends the day, slot and minutes, and takes the answer                                                       | browser |
| 2   | `mark-slot.int.spec.ts` › 2. a missed day turns ½ then ✓ as its slots are marked                                                                                    | int     |
| 2   | `mark-slot.e2e.spec.ts` › 1/2/3/4/5. a missed past day: ✕ → ½ → ✓ (grid cell names, 25 of 40 stays not done)                                                        | e2e     |
| 3   | `mark-slot.int.spec.ts` › 3. marking again updates the record, it is not duplicated · 3b. a slot done twice is counted once for analytics                           | int     |
| 3   | `mark-slot.e2e.spec.ts` › 1/2/3/4/5 … (two rows after five saves)                                                                                                   | e2e     |
| 4   | `mark-slot.int.spec.ts` › 4. 0 resets the slot; 601 is refused; non-integers and negatives too                                                                      | int     |
| 4   | `SlotTimers.browser.spec.tsx` › 015. 601 is refused in the form with «Не больше 600 минут», nothing is sent                                                         | browser |
| 4   | `mark-slot.e2e.spec.ts` › 1/2/3/4/5 … (601 refused, 0 resets the slot and the day goes back to ½)                                                                   | e2e     |
| 5   | `mark-slot.int.spec.ts` › 5. a future day, day 0 and a day past the program are refused and write nothing · 10. a direct API write by a student stays refused (403) | int     |
| 5   | `SlotTimers.browser.spec.tsx` › 015. a server error is shown and the form stays open                                                                                | browser |
| 5   | `mark-slot.e2e.spec.ts` › 5/7. a future day has no controls                                                                                                         | e2e     |
| 6   | `mark-slot.int.spec.ts` › 6. a paused or finished program cannot be marked — **a single day inside a pause waits for story 017** (see Notes)                        | int     |
| 7   | `mark-slot.int.spec.ts` › 7. a running timer on that slot is stopped and the manual value replaces the total · 7b. a timer on another slot keeps running            | int     |
| 7   | `mark-slot.e2e.spec.ts` › 5/7. today can be marked and replaces a running timer                                                                                     | e2e     |
| —   | `mark-slot.int.spec.ts` › 8. the enrollment is the signed-in student’s own · 9. no program: nothing to mark                                                         | int     |
| —   | `address-form.unit.spec.ts` › «вы» catalog (new keys in `StudyTimer`, no new namespace)                                                                             | unit    |
