---
id: 007
title: Murad closes a day in a few taps
status: approved
---

# 007 — Close a day from the tracker page

**As** Murad
**I want** to tap today's cell on my phone, confirm 90 minutes and write 2–3 short notes
**so that** logging takes under a minute and never becomes the reason to skip it.

## Acceptance criteria

1. `[happy]` **Given** I am signed in (`indie_session`) as an admin **when** I open my challenge page **then** today's and past cells are actionable and open a form: minutes (default `dailyMinutes`) and notes.
2. `[happy]` **Given** the form **when** I submit 90 minutes and notes **then** the day becomes closed, progress updates, and the form closes.
3. `[happy]` **Given** a past day that I forgot **when** I close it **then** it is saved for that day (backfilling is allowed).
4. `[edge]` **Given** an already closed day **when** I submit again **then** the existing entry is updated, not duplicated.
5. `[edge]` **Given** a future day, or a day outside 1…90 **when** I submit (incl. a forged request) **then** the action refuses with an error code.
6. `[edge]` **Given** minutes outside 1…600 or notes over 500 characters **when** I submit **then** I see a translated validation message and nothing is saved.
7. `[edge]` **Given** I am not signed in **when** I view the page **then** cells are read-only and a forged action call is refused.
8. `[edge]` **Given** I double-tap submit **when** the action runs **then** exactly one entry exists.
9. `[happy]` **Given** a successful close **when** it is saved **then** `track('challenge_day_closed')` fires without personal data.

## Out of scope

- Reminders / notifications. Undo of a closed day (edit is enough). Timer inside the page.

## Verification

| #   | Test (file › name)                  | Layer |
| --- | ----------------------------------- | ----- |
|     | filled in during step 3 of /feature |       |
