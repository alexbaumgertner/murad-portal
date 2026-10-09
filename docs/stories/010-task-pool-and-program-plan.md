---
id: 010
title: Murad keeps a task pool by level and builds a default plan for each program
status: done
---

# 010 — Task pool by level and the program's default plan

**As the** owner
**I want** to write tasks once, tag them by level, and lay them out as a default plan for a program
**so that** every new student on that level gets a ready plan that I only need to adjust.

## Data model

- `task-pool`: `level` enum A1, A2, B1, B2, C1, C2, required; `title` ≤80, required (for Murad's lists, not shown to students); `text` {ru required, en optional} ≤1000; `slotType` relation, optional (which activity the task belongs to). Write: owner. Read: owner only (students see copies, see 018).
- `program-plan-items`: `program` relation; `week` int 1…program.durationWeeks; `day` int 1–7; `order` int 1–3; `task` relation → `task-pool`. Unique (program, week, day, order). Write/read: owner only.
- Rule: a plan item's task level must be within [program.levelFrom, program.levelTo].

## Acceptance criteria

1. `[happy]` **Given** the owner in `/admin` **when** he creates pool task level B1 «Отзыв на серию», text «Напиши отзыв на любую серию (200 слов) и будь готов обсудить» **then** it is saved and appears in «Пул заданий», filterable by level and slot type.
2. `[happy]` **Given** program B1 → B2 **when** the owner opens «План по умолчанию» and puts that task on week 1, day 5 **then** the plan item is saved and shown in a week × day grid.
3. `[happy]` **Given** the plan grid **when** the owner copies week 1 to weeks 2–4 **then** plan items are created for those weeks, existing items in the target weeks are not overwritten, and a summary «Скопировано: 6, пропущено (занято): 2» is shown.
4. `[edge]` **Given** program B1 → B2 **when** the owner adds an A1 task to its plan **then** saving fails with «Уровень задания (A1) вне программы B1 → B2».
5. `[edge]` **Given** a day with 3 plan items **when** adding a 4th **then** «В дне не больше 3 заданий».
6. `[edge]` **Given** week 53 in a 52-week program, or day 8 **then** a range error.
7. `[edge]` **Given** a pool task used in any program plan **when** the owner deletes it **then** deletion is refused with «Задание используется в программах: <titles>».
8. `[edge]` **Given** program durationWeeks is reduced from 52 to 40 while plan items exist in weeks 41–52 **then** saving fails with «Есть задания после недели 40: удали их сначала».
9. `[edge]` **Given** a pool task text is edited **then** existing students' plans do not change (they hold copies, 018); a hint says so in the editor: «Изменения попадут только в новые планы».
10. `[access]` **Given** a student or anonymous **when** requesting `task-pool` or `program-plan-items` **then** 403 / nothing returned.

## Out of scope

- Per-student plan (018), import from Google Sheets, attachments, AI-generated tasks.

## Notes

- Depends on 009. Migration required. D-SP-5 (revised).
- Replaces the earlier draft «Murad writes assignments for weeks and days».
- Copying weeks may push the PR over 400 lines; if so, split item 3 into its own story.

## Verification

| #   | Test (file › name)                                                                                                                           | Layer        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | `task-pool.int.spec.ts` › 1. the owner creates a pool task › saves a B1 task … finds it by level and by slot type · needs a level, a title … | int          |
| 1   | `task-pool.e2e.spec.ts` › Murad writes a B1 task and finds it in the pool list                                                               | e2e          |
| 2   | `task-pool.int.spec.ts` › 2. the owner puts a task on the default plan › saves week 1, day 5 … · refuses the same place twice                | int          |
| 2   | `task-pool.e2e.spec.ts` › the plan grid shows week × day …                                                                                   | e2e          |
| 3   | `task-pool.int.spec.ts` › 3. copying a week › fills free places of weeks 2–4 and reports copied and skipped · refuses targets beyond …       | int          |
| 3   | `program-plan-shape.unit.spec.ts` › 3. copies into free places only and counts what it skipped                                               | unit         |
| 3   | `task-pool.e2e.spec.ts` › … copies week 1 into weeks 2–3 · `CopyWeekForm.browser.spec.tsx` › shows the summary / shows an error              | e2e, browser |
| 4   | `task-pool.int.spec.ts` › 4. the task level must fit the program · `program-plan-shape.unit.spec.ts` › keeps a task level inside …           | int, unit    |
| 5   | `task-pool.int.spec.ts` › 5. at most 3 tasks a day › refuses a 4th item … · refuses moving an item onto a full day                           | int          |
| 6   | `task-pool.int.spec.ts` › 6. ranges › refuses week 53 …, week 0, day 8 and order 4                                                           | int          |
| 7   | `task-pool.int.spec.ts` › 7. a pool task in use cannot be deleted                                                                            | int          |
| 8   | `task-pool.int.spec.ts` › 8. shortening a program › refuses 52 → 40 while items sit in weeks 41–52 …                                         | int          |
| 9   | `task-pool.int.spec.ts` › 9. editing a pool task · `task-pool.e2e.spec.ts` › the hint is visible in the editor                               | int, e2e     |
| 10  | `task-pool.int.spec.ts` › 10. access › a student and an anonymous caller cannot read or write … (403)                                        | int          |
