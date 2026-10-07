---
id: 008
title: Murad marks a video published and writes a 3-sentence retro
status: draft
depends_on: [006, 007] # reuses getCurrentUser() and the signed-in page mode from 007
runs: no schema (fields come from 005's challenge-videos); edits the challenge page
---

# 008 — Video publication and retro

**As** Murad
**I want** to mark the block's video as published with its YouTube link and answer three questions
**so that** the primary metric (6 videos) and the learning metric are tracked next to the days.

## Files

- `src/features/challenge/actions.ts#saveVideoAction` → `service.ts#saveVideo(payload, user, input)`: upsert the
  `challenge-videos` row for (`challenge`, `blockNumber`) with `overrideAccess: false` and `user`.
- Zod: YouTube URL allow-list (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `https` only), normalised
  in the schema; retro answers trimmed, ≤ 400 chars. Error codes: `invalid_url`, `invalid_retro`, `invalid_date`,
  `unauthorized`, `not_found`, `server`.
- `src/components/VideoRetroForm/` (client leaf) and a read-only block footer for visitors. Video links are plain
  `<a rel="noopener noreferrer">` — no embed, so CSP is unchanged.
- `analytics.ts` catalog: `challenge_video_saved: { published: boolean }`.

## Acceptance criteria

1. `[happy]` **Given** I am signed in **when** I open a block on my challenge page **then** I can set the title, YouTube URL and publish date and fill "What worked?", "Where did viewers drop off / what didn't land?", "What will I change next time?".
2. `[happy]` **Given** a video with `publishedAt` **when** a visitor opens the page **then** the block shows a link to the video and the three retro answers; the videos bar (010) counts it.
3. `[edge]` **Given** a URL that is not a YouTube watch / youtu.be / shorts link (incl. `javascript:` and `http:`) **when** I save **then** it is rejected with a translated message.
4. `[edge]` **Given** a retro answer over 400 characters **when** I save **then** it is rejected.
5. `[edge]` **Given** a video published before its block starts or after the challenge ends **when** I save **then** it is accepted and still counted.
6. `[edge]` **Given** a block without a video row yet **when** I save **then** the row is created for that block; a `blockNumber` outside 1…6 is refused.
7. `[edge]` **Given** I am not signed in **when** I call the action **then** it returns `unauthorized` and nothing is saved.
8. `[edge]` **Given** a block with retro answers but no `publishedAt` **when** a visitor opens the page **then** the retro is shown but the video is not counted as published.

## Out of scope

- Fetching YouTube stats (views, retention) — candidate for a later story via the YouTube Analytics API.
- Embedding the video player.

## Verification

| #   | Test (file › name)                  | Layer                  |
| --- | ----------------------------------- | ---------------------- |
|     | filled in during step 3 of /feature | unit · int · e2e       |
