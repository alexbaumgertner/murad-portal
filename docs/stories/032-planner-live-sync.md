---
id: 032
title: Planner changes show up for the other side without reloading the page
status: approved
---

# 032 — Planner live sync

**As** Murad (owner) or a student
**I want** the other side's changes in the planner to appear without reloading the page
**so that** the planner behaves like the Google Sheet it replaced.

Epic: `weekly-planner-epic.md`. Spike and options: `docs/spikes/002-planner-realtime-sync.md`. Approach: poll a light
planner revision every ~5 s while the tab is visible, refresh when it changes (no new infrastructure, no migration).
Approved by the owner in chat on Oct 16, 2026: a delay of up to ~5 s is fine, Vercel Hobby, only `/study/planner`.
Presence ("the other person is here now") is story 033. Two PRs: (1) client components take a server snapshot plus a local overlay, no behavior change; (2) revision, polling,
indicator, tests.

## Acceptance criteria

1. `[happy]` **Given** a student with the planner open **when** the owner writes a task in a cell **then** within 5 s
   the student sees it without reloading.
2. `[happy]` **Given** the owner with a student's planner open **when** the student ticks a task or writes a diary entry
   **then** within 5 s the owner sees the tick or the entry, and the progress bars update.
3. `[edge]` **Given** a user typing in a cell or a diary field **when** a remote change arrives **then** the field in
   focus keeps its text, caret and focus; the remote value for other fields is applied at once, and for that field after
   blur unless the user saved their own value.
4. `[edge]` **Given** a cell emptied by one side (its record is deleted) **then** the other side sees it empty.
5. `[edge]` **Given** the owner removes a row or deletes the week the student is on **when** the student saves **then**
   the page shows a translated message and the next refresh shows the current grid, with no crash.
6. `[access]` **Given** a student, an anonymous caller or a foreign planner id **when** the revision is requested
   **then** the answer is `not_found` / `unauthorized` and no data of another planner is exposed.
7. `[edge]` **Given** a hidden tab **then** nothing is polled; on becoming visible the revision is checked at once.
8. `[edge]` **Given** a failing request **then** polling backs off (up to ~30 s), the indicator says the connection is
   lost, and it recovers by itself.
9. `[happy]` **Given** the `en` and `ru` locales **then** the indicator and error texts exist in both; the page works at
   360 px.

## Out of scope

- Push below one second (managed pub/sub, spike option B) and "the other person is here now" presence.
- `day-comments` of the program on `/study`.
- Merging two edits of the same field (last write wins, as today).

## Verification

| #   | Test (file › name)                                         | Layer                         |
| --- | ---------------------------------------------------------- | ----------------------------- |
| 1–2 | `tests/e2e/planner-live-sync.e2e.spec.ts` › two contexts   | e2e                           |
| 3   | `tests/browser/PlannerGrid.browser.spec.tsx` › keeps focus | browser                       |
| 4   | `tests/int/planner-revision.int.spec.ts` › emptied cell    | int                           |
| 5   | `tests/browser/PlannerGrid.browser.spec.tsx` › removed row | browser                       |
| 6   | `tests/int/planner-revision.int.spec.ts` › access          | int                           |
| 7–8 | `tests/browser/usePlannerSync.browser.spec.tsx` › polling  | browser                       |
| 9   | manual: 360 px, both locales                               | browser (Chrome DevTools MCP) |
