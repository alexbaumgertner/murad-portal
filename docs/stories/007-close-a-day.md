---
id: 007
title: Murad closes a day in a few taps
status: done
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

| #   | Test (file › name)                                                                                                                                                                                                                                                 | Layer   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 1   | `close-day.e2e.spec.ts` › Murad closes today in a few taps … · future cells are not actionable · a visitor sees read-only cells and no form                                                                                                                        | e2e     |
| 1   | `CloseDayCell.browser.spec.tsx` › opens a form with the daily target as the default minutes                                                                                                                                                                        | browser |
| 2   | `close-day.int.spec.ts` › signed in › closes today with minutes and notes                                                                                                                                                                                          | int     |
| 2   | `close-day.e2e.spec.ts` › Murad closes today in a few taps and sees progress change (form closes, cell turns closed, survives reload)                                                                                                                              | e2e     |
| 2   | `CloseDayCell.browser.spec.tsx` › submits the slug, day, minutes and notes, then closes the form                                                                                                                                                                   | browser |
| 3   | `close-day.int.spec.ts` › signed in › backfills a forgotten past day                                                                                                                                                                                               | int     |
| 3   | `close-day.e2e.spec.ts` › a forgotten past day can be backfilled, and a second save updates it                                                                                                                                                                     | e2e     |
| 4   | `close-day.int.spec.ts` › signed in › updates an already closed day instead of duplicating it · clears the notes when the form is saved without them                                                                                                               | int     |
| 4   | `CloseDayCell.browser.spec.tsx` › prefills a closed day and offers to save changes                                                                                                                                                                                 | browser |
| 5   | `close-day.int.spec.ts` › signed in › refuses a future day with a code · refuses day … (0, -3, 91, 1000, 2.5, abc, empty) · refuses day 91 of a 90-day challenge · refuses every day of a challenge that has not started · flips to the next day at local midnight | int     |
| 5   | `close-day-schema.unit.spec.ts` › rejects dayNumber … · rejects a missing or oversized slug                                                                                                                                                                        | unit    |
| 6   | `close-day-schema.unit.spec.ts` › rejects minutes … · accepts the minutes boundary · accepts 500 characters of notes and rejects 501                                                                                                                               | unit    |
| 6   | `close-day.int.spec.ts` › returns translated-validation codes for bad minutes and notes (nothing saved)                                                                                                                                                            | int     |
| 6   | `CloseDayCell.browser.spec.tsx` › shows a translated message for the code … in both locales · keeps what was typed after an error                                                                                                                                  | browser |
| 6   | `close-day.e2e.spec.ts` › invalid minutes and long notes show a translated message and save nothing                                                                                                                                                                | e2e     |
| 7   | `close-day.int.spec.ts` › forged calls › (no cookie · forged signature · hand-made cookie · expired session · deleted user · bearer header + user field · session checked before validation · service without a user)                                              | int     |
| 7   | `close-day.e2e.spec.ts` › a visitor sees read-only cells and no form                                                                                                                                                                                               | e2e     |
| 8   | `close-day.int.spec.ts` › signed in › creates exactly one entry for a double submit (3 parallel calls)                                                                                                                                                             | int     |
| 8   | `CloseDayCell.browser.spec.tsx` › disables the form while saving, so a double tap sends one request                                                                                                                                                                | browser |
| 9   | `close-day.int.spec.ts` › side effects › tracks challenge_day_closed without personal data · does not track a refused call · revalidates the concrete per-locale page paths                                                                                        | int     |
| 9   | `analytics.unit.spec.ts` › challenge_day_closed › is in the catalog and carries only a boolean                                                                                                                                                                     | unit    |

No schema change, so no migration; `src/access/*` and the collections are untouched. "Admin" is any signed-in user (`pnpm create-admin` is the only way to create one; there is no role field).
