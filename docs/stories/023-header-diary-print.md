---
id: 023
title: Planner header, editable labels, mini-diary and print
status: done
---

# 023 — Header, diary, print

**As the** owner **I want** a header with name, goal, exam subtitle, editable headings and a mini-diary **so that** the sheet looks like the paper plan I know.

## Acceptance criteria

1. `[happy]` **Given** a new planner **then** the header shows placeholders «NAME» / goal, an empty subtitle strip, no example data.
2. `[happy]` **Given** the owner edits schedule label, name, goal label, goal, subtitle, headings, weekday names **then** they save (Enter confirms single-line, Esc cancels, blur saves) and show immediately.
3. `[happy]` **Given** the strip **then** it shows `WEEK 01 · OCTOBER 12, 2026` computed from the base date (English month names), independent of overrides of the labels.
4. `[happy]` **Given** «Exercises» and «Questions» columns **then** each has seven day entries per week, multi-line, wrapping, auto-growing, independent per week.
5. `[happy]` **Given** the student **when** she writes a diary entry **then** it saves (Q-WP-1) and she cannot edit labels, goal or tasks.
6. `[edge]` **Given** a diary entry over 2000 chars **then** `textTooLong`; pasted HTML is shown as text.
7. `[happy]` **Given** «Print» **then** `@media print`: A4 landscape, settings, week tabs and add/remove buttons hidden, borders kept, no clipped text, background images optional.
8. `[edge]` **Given** a 360 px screen **then** the header wraps; goal text stays legible.
9. `[access]` **Given** a student **then** header fields are read-only (403 on write).

## Out of scope

Progress strip content (024), fonts (025).

## Verification

| #     | Test                                                                 | Layer   |
| ----- | -------------------------------------------------------------------- | ------- |
| 3     | `planner-dates.unit.spec.ts` › strip label                           | unit    |
| 2,4,6 | `PlannerHeader.browser.spec.tsx`, `PlannerDiary.browser.spec.tsx`    | browser |
| 5,9   | `planner.int.spec.ts` › access                                       | int     |
| 7     | `planner.e2e.spec.ts` › print (`page.emulateMedia({media:'print'})`) | e2e     |
