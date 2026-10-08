---
id: 008
title: Murad marks a video published and writes a 3-sentence retro
status: approved
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

| #   | Test (file › name)                  | Layer |
| --- | ----------------------------------- | ----- |
|     | filled in during step 3 of /feature |       |
