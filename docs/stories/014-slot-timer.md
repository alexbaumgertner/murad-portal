---
id: 014
title: Slot timer that plays a sound when the minimum is reached
status: approved
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
