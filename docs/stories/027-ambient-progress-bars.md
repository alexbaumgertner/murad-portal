---
id: 027
title: Ambient animations and styling of the progress bars
status: approved
---

# 027 — Ambient bars

**As the** owner or student **I want** calm, atmospheric progress bars **so that** the planner is pleasant to look at every day.

## Acceptance criteria

1. `[happy]` **Given** the four-week and deadline bars **then** each has independent settings: animation, fill, track, highlight, color opacity, grain intensity 0–100%, grain size, animation on/off.
2. `[happy]` **Given** the 11 styles — No Animation, Ambient Flow, Soft Aurora, Morning Mist, Silk Light, Cloud Bloom, Slow Tide, Velvet Breathing, Film Grain, Grainy Haze, Moonlight **then** each is visually distinct, implemented with transform/opacity of layers inside the filled area (no full-screen blur animation).
3. `[happy]` **Given** any style **then** durations are 23–45 s, loops are seamless, no stripes, flashes, bubbles or scanning lines.
4. `[happy]` **Given** the percent changes **then** the fill width follows with a short transition (≤ 400 ms) and always equals the calculated percent.
5. `[happy]` **Given** «No Animation» or animation off **then** no CSS animation is running (`getAnimations()` is empty).
6. `[happy]` **Given** `prefers-reduced-motion: reduce` **then** all bars are static.
7. `[happy]` **Given** grain 0 **then** the bar is smooth (no grain layer).
8. `[edge]` **Given** the overlay **then** the percent label is outside the animated layers and never covered.
9. `[edge]` **Given** a stored unknown style **then** «No Animation» is used.

## Out of scope

Weekly strip indicator stays plain text.

## Notes

The prompt says «11 options» and in its test «ten» — we build 11 (list above).

## Verification

| #           | Test                                                                                     | Layer   |
| ----------- | ---------------------------------------------------------------------------------------- | ------- |
| 1,9         | `planner-bars.unit.spec.ts` (schema, defaults)                                           | unit    |
| 2,3,5,6,7,8 | `PlannerBar.browser.spec.tsx` (`getAnimations()`, durations, reduced motion via emulate) | browser |
| 4           | `planner.e2e.spec.ts` › width equals percent                                             | e2e     |
| 2           | manual: look at each of 11 in Chrome DevTools MCP, light + dark paper                    | browser |
