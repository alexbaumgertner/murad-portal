---
id: 034
title: Планер на всю ширину, шапка наверху, недели сразу под ней, свои задания ученика
status: done
---

# 034 — Planner: full width, header on top, student's own tasks

**As** a student (and Murad, the owner)
**I want** the planner to use the whole window, start with its own header and the week pills, and let me write my own task in a day cell
**so that** the schedule looks like the mock, fits more on the screen, and I can plan extra work myself.

Epic: `weekly-planner-epic.md`. Source: owner's message of Oct 17, 2026 with screenshots. Desktop first; mobile is not
polished in this story (it must not break: no horizontal page scroll at 360 px).

## Decisions (owner, Oct 17, 2026)

- Navigation that leaves with the site header and «Назад» moves to the **footer** (site footer on `/study/planner`).
- «Чёрный фон» = the **active week pill** only. The dark title bars of the planner header stay as they are.
- Own task = a separate **«+ своё»** button in the cell; the task is marked as the student's own.
- Width 100% applies to **`/study/planner` only**.

## Acceptance criteria

Layout

1. `[happy]` **Given** a signed-in student or owner **when** `/study/planner` opens at 1920 px **then** the planner fills
   the window width (side padding only, no `--width-content` cap) and the page does not scroll horizontally.
2. `[happy]` **Given** the planner page **then** the first thing on screen is the planner header
   («РАСПИСАНИЕ: имя · ЦЕЛЬ») — no site/student header above it and no «Назад» link — and the week pills sit directly
   under the header, before the grid. Owner: the week add/copy/delete bar stays below the grid.
3. `[happy]` **Given** the planner page **then** the footer contains «К занятиям» (→ `/study`), the sign-out button and
   the EN/RU switch; the other `/study` pages keep their header unchanged.
4. `[edge]` **Given** no planner yet (owner sees «Создать», student sees «пока нет») **then** the page still has a way
   back (the footer) and no empty gap at the top.
5. `[happy]` **Given** the active week pill **then** it has no black background: light surface, highlighted by an
   accent border and bold text; `aria-current="page"` stays; contrast ≥ 4.5:1 in light and dark.
6. `[edge]` **Given** print **then** the footer and week pills are hidden as before; the sheet is unchanged.

Student's own task

7. `[happy]` **Given** a student and an empty cell **when** she presses «+ своё», types text and leaves the field
   (blur/Enter) **then** the task is saved, shown with an «своё» mark and can be ticked; the owner sees it too.
8. `[happy]` **Given** her own task **when** she edits or clears it **then** it is saved or the cell is emptied
   (the tick is cleared with the text, as for any task).
9. `[edge]` **Given** a cell with a task of Murad's (typed by him or picked from his types) **then** the student cannot
   overwrite it with free text: the button is absent and the server refuses (`forbidden`).
10. `[edge]` **Given** text longer than 500 characters or only spaces/`-`/`—` **then** it is rejected or treated as
    empty with an error code translated in both locales (no sentence from the action).
11. `[edge]` **Given** another student, a visitor or a foreign planner **then** the action is refused; a student cannot
    create tasks in someone else's planner.
12. `[happy]` **Given** the owner edits an own-task cell **then** it stops being «своё» (it is now his text). The live
    sync (story 032) shows the student's new own task to the owner without reload.
13. `[happy]` **Given** locales `en` and `ru` **then** every new string exists in both `messages/*.json`.

## Data model

New checkbox `own` (default `false`) on `planner-cells` → `pnpm generate:types` + **migration** (`pnpm migrate:create
planner_own_tasks`); the student may write `text`+`own` only through the action, access of the collection is unchanged
(writes stay with `overrideAccess: true` after the service checks). Added to the backup JSON export/import (story 028).

## Out of scope

- Mobile layout polish; width of other pages; editing the header's colors.
- Free text for several rows at once, templates, recurring own tasks.
- Changing the owner's task types list.

## Files to touch (estimate)

`study/planner/page.tsx` + `page.module.css` (width, order, no «Назад»), `study/layout.tsx` (no header on the planner),
`SiteFooter` (planner links variant), `PlannerWeekNav.module.css`, `PlannerGrid.tsx` + css (+ своё), `service.ts` /
`actions.ts` / `schema.ts` (own task, error codes), `PlannerCells.ts`, backup import/export, migration,
`messages/*.json`, `tests/…`.

## Verification

| #     | Test (file › name)                                                                                       | Layer   |
| ----- | -------------------------------------------------------------------------------------------------------- | ------- |
| 1–3,5 | `tests/e2e/planner-layout.e2e.spec.ts` › `full width, header first, weeks under it, nav in the footer`   | e2e     |
| 4     | `tests/e2e/planner-layout.e2e.spec.ts` › `without a planner the page still has a way back in the footer` | e2e     |
| 3     | `tests/e2e/planner-layout.e2e.spec.ts` › `other /study pages keep the student header`                    | e2e     |
| 5     | `tests/browser/PlannerWeekNav.browser.spec.tsx` › `034 5. the current week is not on a black background` | browser |
| 6     | manual: print preview (footer nav, week pills, «+ своё» are `display: none` in print)                    | browser |
| 7–8   | `tests/browser/PlannerGrid.browser.spec.tsx` › `034 7…` / `034 7/8…`                                     | browser |
| 9–11  | `tests/int/planner-own-task.int.spec.ts` › `9.` / `10.` / `11.`; browser `034 9`, `034 10`               | int     |
| 12    | `tests/int/planner-own-task.int.spec.ts` › `12. when the owner edits…`                                   | int     |
| 13    | `messages/*.json` key-parity unit test                                                                   | unit    |
