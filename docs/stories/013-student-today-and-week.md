---
id: 013
title: Student sees what to do today and the week grid
status: done
---

# 013 — «Сегодня» and the week grid

**As a** student
**I want** to open the site and immediately see today's activities and my week
**so that** I don't have to work out the plan myself.

## Data model

- None (read-only UI over 009, 012, 018 and `slot-logs` read in a later story; until 015 is merged, all past days show as missed).
- Shown only for enrollments with status active, paused or finished; status assigned shows the start card from 012.

## Acceptance criteria

1. `[happy]` **Given** an active enrollment on program day 10 **when** the student opens `/study` **then** the header shows «День 10 из 364 · Неделя 2», the title of the program and three progress numbers: days done, days missed, total minutes.
2. `[happy]` **Given** day 10 = template day 3 with slots [Anki 20, Сериал 40] and 1–3 tasks in her personal plan (018) **then** «Сегодня» lists each slot (name, «мин. 20 мин», description) and the tasks below.
3. `[happy]` **Given** the same screen **then** a 7-cell grid for the current program week is shown with weekday and date for each day and its state from the epic's state table (marker + colour).
4. `[happy]` **Given** the student taps a past day in the grid **then** that day's slots and assignment are shown read-only (marking comes in 015).
5. `[happy]` **Given** «Все недели» **then** a list of weeks 1…N, the current one highlighted, past weeks with a done/total count; tapping a future week shows its slots and tasks read-only (Q7).
6. `[ui]` **Given** `addressForm` = vy **then** all texts on this screen use the «вы» form.
7. `[edge]` **Given** a rest day (0 slots) **then** «Сегодня отдых» is shown.
8. `[edge]` **Given** today is past the last program day **then** «Программа пройдена» with totals; status becomes finished.
9. `[edge]` **Given** time zone Asia/Almaty and the device clock at 23:30 UTC **then** «today» is computed in Asia/Almaty (unit test for the boundary).
10. `[ui]` **Given** a 360 px screen **then** no horizontal scroll, cells ≥ 32 px, state not conveyed by colour only.
11. `[ui]` All texts exist in ru and en; empty and error states have plain-language messages.

## Out of scope

- Timer (014), marking (015), comments (016), pause (017).

## Notes

- Executor: Codex (UI only). Day calculation helper lives in shared lib and is unit-tested (start day, week boundary, day 364/365, paused days once 017 exists).
- Reuse grid component from challenge page 006 where possible.
- Depends on 012 and 018. Texts come in three variants: ru-ty, ru-vy, en (D-SP-8).

## Verification

| #   | Test (file › name)                                                                                                                                       | Layer |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | `student-today.e2e.spec.ts` › 1–4/6/10. day 10: header, slots, tasks, the week grid, a past day, «вы» (header «День 10 из 56 · Неделя 2», three numbers) | e2e   |
| 1   | `study-today-shape.unit.spec.ts` › 1 · counts done, missed and minutes … · day 10 is week 2, template day 3                                              | unit  |
| 2   | `student-today.e2e.spec.ts` › 1–4/6/10 … (slot names, «мин. 20 мин», description, the two personal tasks)                                                | e2e   |
| 2   | `study-today.int.spec.ts` › 1/2. day 10: program day, week, slots with names, minimum and description                                                    | int   |
| 3   | `student-today.e2e.spec.ts` › 1–4/6/10 … (7 cells, today named and outlined, rest «—»)                                                                   | e2e   |
| 3   | `study-today-shape.unit.spec.ts` › 3 · builds 7 cells for the current week with dates and states · day states (marker besides colour)                    | unit  |
| 4   | `student-today.e2e.spec.ts` › 4/5. tapping a day of the week opens it; «Все недели» lists weeks and a future week                                        | e2e   |
| 5   | `student-today.e2e.spec.ts` › 4/5 … (weeks list, current one highlighted, past week «выполнено 0 из 1», future week with slots, no edit controls)        | e2e   |
| 5   | `study-today-shape.unit.spec.ts` › 5 · counts done of total training days in a week, rest days excluded                                                  | unit  |
| 6   | `student-today.e2e.spec.ts` › 1–4/6/10 … («Нажмите на день» for a «вы» student)                                                                          | e2e   |
| 6   | `address-form.unit.spec.ts` › «вы» catalog (new namespace `StudyToday` in `STUDENT_NAMESPACES`)                                                          | unit  |
| 7   | `student-today.e2e.spec.ts` › 7. a rest day says «Сегодня отдых»                                                                                         | e2e   |
| 8   | `student-today.e2e.spec.ts` › 8. past the last day: «Программа пройдена» with totals, status finished                                                    | e2e   |
| 8   | `study-today.int.spec.ts` › 8. past the last day the enrollment becomes finished and is still shown · does not finish a program on its last day          | int   |
| 9   | `study-today-shape.unit.spec.ts` › 9 · computes «today» in Asia/Almaty, not on the device clock (23:30 UTC)                                              | unit  |
| 9   | `study-today.int.spec.ts` › 9. «today» follows Asia/Almaty, not the UTC clock                                                                            | int   |
| 10  | `student-today.e2e.spec.ts` › 1–4/6/10 … and 4/5 … (no horizontal scroll at 360 px, cells ≥ 32 px; every state has a marker and an accessible name)      | e2e   |
| 11  | `i18n.unit.spec.ts` › every key in every locale · empty state `Study.empty`, error `error.tsx`, loading `study/loading.tsx`                              | unit  |
