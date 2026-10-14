---
id: 025
title: Planner colors with transparency and typography per section
status: approved
---

# 025 — Colors and typography

**As the** owner (and the student, Q-WP-2) **I want** to change colors, opacity and fonts **so that** the planner fits the student's taste.

## Acceptance criteria

1. `[happy]` **Given** Settings → Colors **then** independent color + 0–100% opacity for: main header, secondary header, priority column, done cell, accent, paper, primary text, secondary text, grid lines. Alpha is applied as real `rgba` / `color-mix`, never blended against white.
2. `[happy]` **Given** the defaults **then** they match the mock (charcoal header, gray strip, soft-blue priority, vivid-green done, white paper).
3. `[happy]` **Given** «Reset colors» **then** only colors return to default.
4. `[happy]` **Given** Settings → Typography **then** 30+ fonts with Latin **and** Cyrillic (verified list in the story's PR), in three groups: sans, serif, expressive; a font loads only when chosen; the portal font stays the default.
5. `[happy]` **Given** 14 sections (schedule label, student, goal label, goal, subtitle, week info, dates, weekdays, priority labels, tasks, diary headings, diary day labels, diary text, progress) **then** each has family, size 9–90 px, bold, italic; changes apply immediately.
6. `[happy]` **Given** «Apply font to all sections» **then** only families change; sizes, bold, italic stay.
7. `[happy]` **Given** «Restore original font everywhere» **then** only families reset; «Reset all typography» resets families, sizes, bold, italic.
8. `[edge]` **Given** a font unavailable offline **then** the fallback stack is used; Cyrillic text never turns into boxes.
9. `[edge]` **Given** low-contrast pairs (contrast < 3:1) **then** a non-blocking warning.
10. `[edge]` **Given** an invalid stored appearance JSON **then** defaults are used and the broken part is dropped.
11. `[access]` **Given** a student **then** she can write only her own `appearance`.

## Out of scope

Background image (026), bars (027).

## Notes

- Appearance = Zod schema `appearanceSchema` (versioned, `.catch(default)` per field), CSS custom properties set on the planner root, CSS Modules for layout. No inline styles beyond dynamic variable values (allowed by AGENTS.md).
- Fonts: `next/font/google` can't load by runtime choice; use a build-time list of `next/font` instances loaded lazily per route chunk — spike first (Q-WP-5).

## Verification

| # | Test | Layer |
| --- | --- | --- |
| 1,2,9,10 | `planner-appearance.unit.spec.ts` | unit |
| 5–8 | `planner-typography.unit.spec.ts` (acceptance scenario H) | unit |
| 3,4,6 | `PlannerSettings.browser.spec.tsx` | browser |
| 11 | `planner.int.spec.ts` | int |
| 8 | `planner.e2e.spec.ts` › Cyrillic renders (screenshot compare off; assert computed font-family) | e2e |
