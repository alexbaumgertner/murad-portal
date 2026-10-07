---
id: 007
title: Murad closes a day in a few taps
status: draft
depends_on: [006]
runs: no schema; edits the challenge page — merge after or before 008/010, not simultaneously
---

# 007 — Close a day from the tracker page

**As** Murad
**I want** to tap today's cell on my phone, confirm 90 minutes and write 2–3 short notes
**so that** logging takes under a minute and never becomes the reason to skip it.

## Files

- `src/features/challenge/actions.ts` — `'use server'`, `closeDayAction` wrapped in `monitorAction`; Zod `safeParse`
  (schema from 005) → `service.ts#closeDay(payload, user, input)` → `track()` after success. Returns
  `{ status: 'success' } | { status: 'error', error: 'invalid_minutes' | 'invalid_notes' | 'day_not_open' | 'unauthorized' | 'not_found' | 'server' }`.
- `src/features/challenge/service.ts` — `server-only`; upsert on (`challenge`, `dayNumber`) with
  `overrideAccess: false` and the `user` passed, so collection access is the guard, not only the action. On a unique
  violation from a concurrent insert, re-read and update (same pattern as `features/waitlist/service.ts`).
- Current user: new helper `getCurrentUser()` in `src/features/auth/` using `payload.auth({ headers })`
  (no such helper exists yet; keep `strategy.ts`/`session.ts` framework-free).
- `src/components/CloseDayForm/` — client leaf, `useActionState`, shown only when the page knows a user is signed in.
- `analytics.ts` catalog: `challenge_day_closed: { backfill: boolean, updated: boolean }`.

## Acceptance criteria

1. `[happy]` **Given** I am signed in **when** I open my challenge page **then** today's and past cells are actionable and open a form: minutes (default `dailyMinutes`) and notes; future cells are not actionable.
2. `[happy]` **Given** the form **when** I submit 90 minutes and notes **then** the day becomes closed, the progress bars update, and the form closes with an `aria-live` confirmation.
3. `[happy]` **Given** a past day that I forgot **when** I close it **then** it is saved for that day (backfilling is allowed).
4. `[edge]` **Given** an already closed day **when** I submit again **then** the existing entry is updated, not duplicated, and the form is pre-filled with the saved values.
5. `[edge]` **Given** a future day, a day outside 1…`durationDays`, or an unknown challenge **when** the action is called (incl. a forged request) **then** it returns `day_not_open` / `not_found` and nothing is saved. "Future" uses the challenge time zone (009).
6. `[edge]` **Given** minutes outside 1…600 or notes over 500 characters **when** I submit **then** I see a translated message for the error code and nothing is saved.
7. `[edge]` **Given** I am not signed in **when** I view the page **then** cells are read-only, and a forged action call returns `unauthorized`.
8. `[edge]` **Given** I double-tap submit (or two requests race) **when** the action runs **then** exactly one entry exists and both calls report success.
9. `[happy]` **Given** a successful close **when** it is saved **then** `track('challenge_day_closed', { backfill, updated })` fires — no ids, no notes; and it does not fire on errors.
10. `[edge]` **Given** a signed-in visitor on a **non-public** challenge's page **when** it loads **then** the page renders for them (signed-in read) while anonymous visitors still get 404.

## Out of scope

- Reminders / notifications. Deleting a closed day (admin only). A timer inside the page.

## Open point

- Criterion 10 means the page reads with the user when signed in — the public query in 006 must stay anonymous;
  add a separate signed-in read rather than widening `getPublicChallenge`.

## Verification

| #   | Test (file › name)                  | Layer                  |
| --- | ----------------------------------- | ---------------------- |
|     | filled in during step 3 of /feature | int · browser · e2e    |
