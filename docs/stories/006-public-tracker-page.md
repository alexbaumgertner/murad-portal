---
id: 006
title: Anyone can watch Murad's challenge progress
status: done
---

# 006 — Public challenge page: 90-cell grid, progress, countdown

**As a** visitor
**I want** to open `/challenge/<slug>` and see the 90 days, what is done and how much time has gone in
**so that** I can follow (and be inspired by) Murad's challenge.

## Acceptance criteria

1. `[happy]` **Given** a public challenge **when** I open its page **then** I see 90 cells grouped into 6 blocks of 15, each block titled with its video topic and numbered "Видео 1…6".
2. `[happy]` **Given** the grid **when** it renders **then** each cell shows its state: closed, today, missed (past and not closed), future — distinguishable without relying on colour alone.
3. `[happy]` **Given** a closed day **when** I tap its cell **then** I see its date, minutes and notes.
4. `[happy]` **Given** the summary from 005 **when** the page renders **then** I see three progress bars — minutes (e.g. "270 / 8 100 мин · 4.5 / 135 ч"), videos published (x / 6), sessions (done / planned) — and a countdown "осталось N дней" to the end.
5. `[edge]` **Given** a challenge that has not started / has finished **when** I open the page **then** the countdown says when it starts / that it is finished, and no cell is marked "today".
6. `[edge]` **Given** a non-public or unknown slug **when** I open the page **then** I get the 404 page.
7. `[edge]` **Given** the rules rich text **when** present **then** it is shown below the grid; when empty the section is hidden.
8. `[edge]` **Given** a 360px viewport **when** the grid renders **then** cells stay tappable (≥ 32px) and nothing scrolls horizontally.
9. `[happy]` **Given** Murad closes a day (007) **when** the page is reloaded **then** it shows the new state (revalidation per locale).

## Out of scope

- Editing from this page (007). Sharing images / OG cards. Comments.

## Verification

| #             | Test (file › name)                                                                                                                                  | Layer                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1, 2, 3, 4, 8 | `tests/e2e/challenge.e2e.spec.ts` › `ru/en: blocks, states, details, summary and 360px targets`                                                     | e2e, desktop + mobile |
| 5, 7, 9       | `tests/e2e/challenge.e2e.spec.ts` › `reload reflects closed days; empty rules and outside-calendar states` (plus rules visible in ru/en grid tests) | e2e, desktop + mobile |
| 6             | `tests/e2e/challenge.e2e.spec.ts` › `unknown and non-public slugs return HTTP 404 in both locales`                                                  | e2e, desktop + mobile |
| 6, 9          | `tests/int/challenge.int.spec.ts` › `public tracker query hides private/unknown slugs and returns fresh days`                                       | integration           |

The page reuses story 005's `summarize`, `percent` and calendar helpers. Dynamic rendering reads
fresh anonymous data on each request, including reloads in either locale and local-midnight rollover.
The shared loading boundary is scoped to the changelog so tracker misses can return HTTP 404 before streaming.
Browser inspection at 360px: 90 cells, no horizontal overflow; e2e checks every target is at least 32px.

Validation: `pnpm check` (206 unit tests), `pnpm test:int` (58 tests) and `CI=true pnpm test:e2e` (91 passed; one existing landing CSP network-idle timeout passed on retry) passed. Reviewer found no P0/P1 issues.
