---
id: 006
title: Anyone can watch Murad's challenge day by day
status: draft
depends_on: [005, 009]
runs: after 005 merges (needs the collections and types); UI-only, no schema
---

# 006 — Public challenge page: the 90-cell grid

**As a** visitor
**I want** to open `/challenge/<slug>` and see the 90 days grouped by video, and what is done
**so that** I can follow (and be inspired by) Murad's challenge.

## Files

- `src/app/(frontend)/[locale]/(site)/challenge/[slug]/page.tsx` — Server Component, rendered per request
  (PROPOSED decision "Challenge page renders per request"); `generateMetadata` with canonical + hreflang via
  `src/i18n/alternates.ts`. Unknown / non-public slug → `notFound()`.
- `src/features/challenge/queries.ts` — `server-only`; `getPublicChallenge(slug, locale)` returns the challenge, its days
  and videos with `overrideAccess: false`, `depth: 0`, and no `user` (the public view never sees more than anonymous
  access allows).
- `src/components/ChallengeGrid/` (Server) and `src/components/DayDetails/` (small client leaf for the tap-to-open
  panel, e.g. `<details>` or a dialog). Copy in `messages/en.json` + `messages/ru.json` under `challenge.*`.
- Add `/challenge/<seeded slug>` to `tests/e2e/devtools.e2e.spec.ts`.

## Acceptance criteria

1. `[happy]` **Given** a public challenge **when** I open its page **then** I see `durationDays` cells grouped into blocks of `blockDays`, each block headed "Video N" (translated) and the video title, or just "Video N" when that video row is missing.
2. `[happy]` **Given** the grid **when** it renders **then** each cell shows its state from `cellState` (009): closed, today, missed, future — distinguishable without colour (icon or text + accessible name such as "Day 12, closed").
3. `[happy]` **Given** a closed day **when** I tap its cell **then** I see its date (in the challenge time zone, formatted for my locale), minutes and notes.
4. `[edge]` **Given** a challenge that has not started / has finished **when** I open the page **then** no cell is marked "today".
5. `[edge]` **Given** a non-public or unknown slug **when** I open `/challenge/<slug>` or `/ru/challenge/<slug>` **then** I get the 404 page with HTTP 404. **(P0)**
6. `[edge]` **Given** rules rich text **when** present **then** it is shown below the grid; when empty the section is not rendered.
7. `[edge]` **Given** a challenge with no closed days **when** the page renders **then** every past cell is "missed", the rest "future", and there is no empty-state error.
8. `[edge]` **Given** a 360px viewport in Russian **when** the grid renders **then** cells are ≥ 32px tappable and nothing scrolls horizontally.
9. `[happy]` **Given** a day is added in the admin **when** the page is reloaded **then** it shows the new state (no stale cache).

## Out of scope

- Progress bars and countdown (010). Editing from the page (007, 008). Linking to the page from the landing (004).
- Sharing images / OG cards. Comments. YouTube embeds.

## Verification

| #   | Test (file › name)                  | Layer      |
| --- | ----------------------------------- | ---------- |
|     | filled in during step 3 of /feature | int · e2e  |
