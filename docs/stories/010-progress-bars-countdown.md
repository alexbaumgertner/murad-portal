---
id: 010
title: Visitors see how much time and how many videos have gone in, and how long is left
status: draft
depends_on: [006, 009]
runs: UI-only; parallel with 007 / 008 is possible but all three edit the challenge page — merge in order
---

# 010 — Progress bars and countdown

**As a** visitor (and Murad)
**I want** three progress bars and a countdown above the grid
**so that** the 135-hour goal and the 6 videos are visible at a glance.

## Files

- `src/components/ChallengeProgress/` (Server Component) fed by `summarize()` from 009, rendered in the 006 page above
  the grid. Bars are `<progress>` / `role="progressbar"` with `aria-valuenow`/`max` and a text label.
- Number formatting via next-intl (`format.number`), so "8 100" / "8,100" follow the locale. Copy under `challenge.progress.*`.

## Acceptance criteria

1. `[happy]` **Given** 270 minutes logged **when** the page renders **then** the minutes bar reads "270 / 8 100 min · 4.5 / 135 h" (Russian: "мин", "ч").
2. `[happy]` **Given** 2 videos with `publishedAt` **when** the page renders **then** the videos bar reads "2 / 6".
3. `[happy]` **Given** 3 closed days and today is day 4 **when** the page renders **then** the sessions bar reads "3 / 4".
4. `[happy]` **Given** a running challenge **when** the page renders **then** the countdown reads "N days left" with correct plural forms in Russian (1 день, 2 дня, 5 дней).
5. `[edge]` **Given** a not-started / finished challenge **when** the page renders **then** the countdown says when it starts (date) / that it is finished.
6. `[edge]` **Given** more minutes than the target **when** the bar renders **then** the fill is capped at 100 % and the text shows the real number.
7. `[edge]` **Given** a 360px viewport in Russian **when** the bars render **then** labels wrap without overflow.

## Out of scope

- Charts over time, streaks, per-block minute totals.

## Verification

| #   | Test (file › name)                  | Layer        |
| --- | ----------------------------------- | ------------ |
|     | filled in during step 3 of /feature | unit · e2e   |
