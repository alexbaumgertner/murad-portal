---
id: 005
title: Murad sets up his 90-day challenge in the admin
status: draft
depends_on: [] # blocked only by the PROPOSED decisions "Challenge content" and "Day notes are public"
runs: sequential # schema + access + migration
---

# 005 — Challenge data model and access

**As** Murad
**I want** to create my challenge (start date, six video topics) in the admin
**so that** the tracker knows the calendar, the blocks and the targets.

## Data model (needs a migration: `pnpm migrate:create challenge`)

All new collections use explicit access from `src/access/` and are registered in `src/payload.config.ts`.
Murad-authored text is **not** `localized` (see PROPOSED decision "Challenge content is single-language").

- `challenges` — `title` (text, required), `slug` (text, unique, index), `startDate` (date, day only),
  `timeZone` (text, default `Asia/Almaty`, validated with `Intl.supportedValuesOf('timeZone')`),
  `durationDays` (number, default 90), `dailyMinutes` (number, default 90), `blockDays` (number, default 15),
  `isPublic` (checkbox, default false, index), `rules` (rich text, optional).
  `useAsTitle: 'title'`, `defaultColumns: ['title', 'startDate', 'isPublic']`.
- `challenge-videos` — one row per block: `challenge` (relationship, required, index), `blockNumber` (number, ≥ 1),
  `title` (text, required), `youtubeUrl`, `publishedAt` (date), `retroWorked`, `retroDropped`, `retroChange`
  (textarea, ≤ 400). Compound unique index (`challenge`, `blockNumber`).
- `challenge-days` — `challenge` (relationship, required, index), `dayNumber` (1…`durationDays`),
  `minutes` (1…600), `notes` (textarea, ≤ 500). Compound unique index (`challenge`, `dayNumber`).
  `createdAt` / `updatedAt` replace the draft's `closedAt` (a row existing = the day is closed).
- Access (`src/access/challenges.ts`):
  - `publicChallengeOrAuthenticated` — signed in ⇒ all; else `{ isPublic: { equals: true } }`.
  - `ofPublicChallengeOrAuthenticated` — signed in ⇒ all; else `{ 'challenge.isPublic': { equals: true } }`
    (for `challenge-days` and `challenge-videos`).
  - create / update / delete: `authenticated` on all three.
- `src/features/challenge/schema.ts` — Zod schema for a day (`dayNumber`, `minutes`, `notes`) and a video, shared with
  the Payload `validate` functions so admin and actions enforce the same limits.

## Acceptance criteria

1. `[happy]` **Given** Murad is signed in **when** he creates a challenge with only title, slug and start date **then** it is saved with defaults 90 / 90 / 15 and `Asia/Almaty`, and is not public.
2. `[edge]` **Given** `durationDays` not divisible by `blockDays` **when** saving **then** validation rejects it with a clear message.
3. `[edge]` **Given** a `challenge-videos` row with `blockNumber` outside 1…`durationDays / blockDays`, or a `challenge-days` row with `dayNumber` outside 1…`durationDays` **when** saving **then** it is rejected.
4. `[edge]` **Given** an invalid IANA time zone **when** saving **then** it is rejected.
5. `[edge]` **Given** a second `challenge-days` row for the same challenge and day (or a second video for the same block) **when** saving **then** it is rejected.
6. `[edge]` **Given** an anonymous Local API call with `overrideAccess: false` (and the REST API) **when** it reads a non-public challenge, its days or its videos **then** nothing is returned; for a public challenge all three are readable. **(P0)**
7. `[edge]` **Given** an anonymous client **when** it creates, updates or deletes any of the three **then** it is refused.
8. `[edge]` **Given** a challenge is switched from public to non-public **when** an anonymous client reads its days **then** nothing is returned.

## Out of scope

- Progress maths (009), public page (006), closing days (007), video retro UI (008).
- Multiple owners, per-user ownership (every signed-in user is Murad — there is one admin).
- Auto-creating the six video rows (Murad adds them in the admin; the page shows "Video N" for missing ones).

## Notes

- `pnpm generate:types`, commit `src/payload-types.ts` and the migration.
- No revalidation hooks: the challenge page renders dynamically (PROPOSED decision "Challenge page renders per request").
- Seed: extend `pnpm seed` with one public demo challenge; add `tests/helpers/seedChallenge.ts` for int/e2e.

## Verification

| #   | Test (file › name)                  | Layer |
| --- | ----------------------------------- | ----- |
|     | filled in during step 3 of /feature | int   |
