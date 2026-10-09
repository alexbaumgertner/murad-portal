---
id: 014
title: Slot timer that plays a sound when the minimum is reached
status: done
---

# 014 — Slot timer with a sound at the minimum

**As a** student
**I want** to start a timer on an activity and hear a signal when I've done the minimum
**so that** I don't watch the clock and know when the slot counts as done.

## Data model
- `slot-logs`: `enrollment` relation; `date` date (program calendar date); `slotIndex` int 0–4; `slotType` relation (snapshot at write time); `minutes` int 0–600; `completed` bool; `timerStartedAt` datetime nullable. Unique (enrollment, date, slotIndex).
- Write: student own only, only for today or past dates of the active enrollment. Read: owner; student own.

## Acceptance criteria
1. `[happy]` **Given** today's slot «Сериал, мин. 40» **when** the student presses «Старт» **then** `timerStartedAt` is saved and a running mm:ss counter is shown.
2. `[happy]` **Given** a running timer **when** elapsed + saved minutes reaches 40 **then** a short sound plays once, the phone vibrates if supported, and the slot shows «Минимум выполнен ✓»; `completed = true`. The timer keeps running.
3. `[happy]` **Given** a running timer **when** «Стоп» **then** whole minutes are added to `minutes` (rounded down, at least 1 if ≥ 30 s) and `timerStartedAt` cleared.
4. `[edge]` **Given** stop at 25 of 40 minutes **then** minutes = 25, completed = false, slot shows «25 из 40 мин»; a next start continues from 25.
5. `[edge]` **Given** a running timer **when** the tab is closed and reopened 30 min later **then** the counter shows the correct elapsed time (D-SP-4) and the sound plays if the minimum was passed while closed — once, on return.
6. `[edge]` **Given** a running timer on slot A **when** «Старт» on slot B **then** A is stopped and saved first, then B starts (one timer at a time).
7. `[edge]` **Given** a timer running for over 240 minutes **then** it is stopped with 240 minutes added.
8. `[edge]` **Given** the timer runs across midnight in the enrollment time zone **then** minutes are saved to the day it was started.
9. `[edge]` **Given** the browser blocks autoplay **then** the signal falls back to a visual banner «Минимум выполнен» without errors; a «Проверить звук» button is available.
10. `[edge]` **Given** a double tap on «Старт» or «Стоп» **then** exactly one state change happens.
11. `[access]` **Given** a student **when** writing a log for another enrollment or a future date **then** 403.

## Analytics
- `slot_completed` {slotTypeId, minutesBucket, viaTimer: true}.

## Out of scope
- Background notifications when the site is closed, Pomodoro, sound settings.

## Notes
- Depends on 013. Migration required. D-SP-4, D-SP-7 (done only at the minimum). Sound file: short, self-hosted, ≤ 50 KB; new dependency only with justification.

## Verification

| #   | Test (file › name)                                                                                                                                                  | Layer   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | `slot-timer.int.spec.ts` › 1. «Старт» saves timerStartedAt and the state carries the running timer                                                                  | int     |
| 1   | `SlotTimers.browser.spec.tsx` › 1. «Старт» sends only the slot and shows a running mm:ss counter                                                                    | browser |
| 1   | `slot-timer.e2e.spec.ts` › 1/3/4/10. start, a double tap, stop … (counter `25:xx`, kept on reload)                                                                  | e2e     |
| 2   | `slot-timer.int.spec.ts` › 2. at the minimum the slot is completed once and the timer keeps running                                                                 | int     |
| 2   | `SlotTimers.browser.spec.tsx` › 2. reaching the minimum plays the signal once, vibrates, and shows «Минимум выполнен ✓»                                              | browser |
| 2   | `slot-timer-shape.unit.spec.ts` › 2. the minimum is reached when saved + elapsed hits it, not before                                                                | unit    |
| 3   | `slot-timer.int.spec.ts` › 3/4. «Стоп» adds whole minutes … · 3. a stop after 30–59 seconds adds one minute, after 10 seconds none                                  | int     |
| 3   | `slot-timer-shape.unit.spec.ts` › 3. whole minutes round down; at least 1 from 30 seconds                                                                           | unit    |
| 4   | `slot-timer.int.spec.ts` › 3/4. … 25 of 40 stays not done and the next start continues                                                                              | int     |
| 4   | `SlotTimers.browser.spec.tsx` › 4. a stop at 25 of 40 minutes shows «25 из 40 мин»                                                                                  | browser |
| 4   | `slot-timer.e2e.spec.ts` › 1/3/4/10 … (a saved 25 of 40 is shown and continues from 25:00)                                                                          | e2e     |
| 5   | `slot-timer.int.spec.ts` › 5. reopening later: the state is computed from timerStartedAt and completion is saved once                                               | int     |
| 5   | `SlotTimers.browser.spec.tsx` › 5. reopened after the minimum passed while closed: counter is correct and sounds once                                               | browser |
| 5   | `slot-timer.e2e.spec.ts` › 2/5/9. the minimum passed while closed … (30:xx, «✓», saved as completed, no second attempt on reload)                                   | e2e     |
| 6   | `slot-timer.int.spec.ts` › 6. starting slot B stops and saves slot A first: one timer at a time                                                                     | int     |
| 7   | `slot-timer.int.spec.ts` › 7. a timer over 240 minutes is stopped with 240 minutes added · a stop long after the cap also adds only 240 minutes                     | int     |
| 7   | `slot-timer-shape.unit.spec.ts` › 7. a timer over 4 hours counts as exactly 240 minutes                                                                             | unit    |
| 8   | `slot-timer.int.spec.ts` › 8. across midnight in the enrollment zone the minutes belong to the day it started · a timer still running after midnight is carried over | int     |
| 8   | `SlotTimers.browser.spec.tsx` › a timer carried over from yesterday can be stopped                                                                                  | browser |
| 9   | `SlotTimers.browser.spec.tsx` › 9. blocked audio falls back to a visible banner; «Проверить звук» retries                                                           | browser |
| 9   | `slot-timer.e2e.spec.ts` › 2/5/9 … (locked audio → banner «Минимум выполнен», «Проверить звук» plays, no page errors)                                              | e2e     |
| 10  | `SlotTimers.browser.spec.tsx` › 10. a double tap on «Старт» sends one request                                                                                       | browser |
| 10  | `slot-timer.int.spec.ts` › 10. a double tap changes state once                                                                                                      | int     |
| 11  | `slot-timer.int.spec.ts` › 11. a student cannot write logs through the API: other enrollment, future date or her own · 11. a student reads only her own logs         | int     |
| —   | `slot-timer.int.spec.ts` › 013 progress: logs now drive the day states and totals · `slot-timer.e2e.spec.ts` › 10. 360 px … (partial day counts minutes, not done)  | int/e2e |
| —   | `address-form.unit.spec.ts` › «вы» catalog (new namespace `StudyTimer` in `STUDENT_NAMESPACES`)                                                                      | unit    |
