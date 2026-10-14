---
id: 026
title: Planner background image with blur, brightness, overlay and grain
status: approved
---

# 026 — Background

**As the** owner or student **I want** a background photo behind the schedule **so that** the planner feels personal.

## Acceptance criteria

1. `[happy]` **Given** Settings → Background **then** color + opacity, and an image upload (JPG, PNG, WebP).
2. `[happy]` **Given** an upload **then** it is resized (long side ≤ 2400 px) and re-encoded in the browser, stored in Media (local / Vercel Blob), referenced from `appearance.background`.
3. `[edge]` **Given** an unsupported type, >10 MB, or a decode error **then** a code error, the previous image stays.
4. `[happy]` **Given** modes cover / contain / center / fit **then** the aspect ratio is preserved.
5. `[happy]` **Given** blur 0–40 px, brightness, **one** overlay slider −100…+100 (negative darkens, positive lightens — no contradictory pair), grain 0–100%, grain size 1–12 **then** each changes the intended property.
6. `[happy]` **Given** the layers (image → blur → overlay → grain → content) **then** blur and grain never touch text or controls (blur is on the image layer only).
7. `[happy]` **Given** grain 0 **then** no grain layer is rendered. Grain is a generated noise texture (SVG `feTurbulence` as data URI, tiled per size), not a dot pattern.
8. `[happy]` **Given** a reload **then** image and settings persist.
9. `[happy]` **Given** «Remove image» **then** the file reference is cleared and the media document is deleted.
10. `[edge]` **Given** transparent paper/header (025) **then** the image shows through.
11. `[access]` **Given** a student **then** she uploads only to her own planner; the image is not publicly listed (private media URL or unguessable path — spike in the PR, CSP `img-src` check).

## Out of scope

Bars grain (027).

## Notes

Likely a migration (relation to Media). CSP is report-only but e2e fails on violations — check `img-src`.

## Verification

| # | Test | Layer |
| --- | --- | --- |
| 2,3 | `planner-image.unit.spec.ts` (size / type / resize math) | unit |
| 5–7,10 | `PlannerBackground.browser.spec.tsx` (computed style of layers) | browser |
| 8,9,11 | `planner-background.int.spec.ts` | int |
| 6 | `planner.e2e.spec.ts` › text stays unblurred (computed `filter` on content = none) | e2e |
