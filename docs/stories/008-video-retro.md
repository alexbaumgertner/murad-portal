---
id: 008
title: Murad marks a video published and writes a 3-sentence retro
status: done
---

# 008 — Video publication and retro

**As** Murad
**I want** to mark the block's video as published with its YouTube link and answer three questions
**so that** the primary metric (6 videos) and the learning metric are tracked next to the days.

## Acceptance criteria

1. `[happy]` **Given** I am signed in **when** I open a block on my challenge page **then** I can set the YouTube URL and publish date and fill "Что сработало?", "Где зрители отвалились / что не зашло?", "Что поменяю в следующем видео?".
2. `[happy]` **Given** a published video **when** a visitor opens the page **then** the block shows a link to the video and the retro; the "videos" bar counts it.
3. `[edge]` **Given** a URL that is not a YouTube watch / youtu.be / shorts link **when** I save **then** it is rejected with a translated message.
4. `[edge]` **Given** a retro answer over 400 characters **when** I save **then** it is rejected.
5. `[edge]` **Given** a video published before its block starts or after the challenge ends **when** I save **then** it is accepted (life happens) and still counted.
6. `[edge]` **Given** I am not signed in **when** I call the action **then** it is refused.

## Out of scope

- Fetching YouTube stats (views, retention) — candidate for a later story via YouTube Analytics API.

## Verification

| #   | Test (file › name)                                                                                                                                                                                                                                                            | Layer                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | `video-retro.e2e.spec.ts` › en/ru: saves a retro, validates, and shows it to visitors at 360px; `video-retro.int.spec.ts` › saves, updates, preserves other blocks and revalidates                                                                                            | E2E, integration       |
| 2   | `video-retro.e2e.spec.ts` › en/ru: saves a retro, validates, and shows it to visitors at 360px; `video-retro.int.spec.ts` › keeps a private challenge hidden after saving                                                                                                     | E2E, integration       |
| 3   | `video-retro.unit.spec.ts` › accepts / rejects URLs (includes javascript: and non-YouTube); `video-retro.int.spec.ts` › refuses invalid input without saving; `video-retro.e2e.spec.ts` › en/ru: saves a retro, validates, and shows it to visitors at 360px                  | Unit, integration, E2E |
| 4   | `video-retro.unit.spec.ts` › bounds each answer at 400 characters; `video-retro.int.spec.ts` › refuses invalid input without saving; `video-retro.e2e.spec.ts` › en/ru: saves a retro, validates, and shows it to visitors at 360px                                           | Unit, integration, E2E |
| 5   | `video-retro.int.spec.ts` › accepts and counts dates outside the challenge (2000 and 2099); `video-retro.e2e.spec.ts` › en/ru: saves a retro, validates, and shows it to visitors at 360px; `challenge-progress.unit.spec.ts` › counts marked publications regardless of date | Integration, E2E, unit |
| 6   | `video-retro.int.spec.ts` › refuses unauthenticated calls before validation (absent / forged cookie); `video-retro.e2e.spec.ts` › en/ru: saves a retro, validates, and shows it to visitors at 360px                                                                          | Integration, E2E       |

Checks: `pnpm check` (246 unit tests), `pnpm test:int` (99 tests), and `pnpm test:e2e` (108 desktop/mobile cases verified). The full E2E run passed 99 cases; 8 cold-compilation timeouts and 1 skipped serial case passed with `--last-failed --workers=1 --timeout=90000` (9/9). No assertions or repository timeouts were changed. Russian UI inspected in Chromium at 360px; no horizontal overflow. Reviewer: no P0/P1 findings.
