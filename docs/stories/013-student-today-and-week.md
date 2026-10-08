---
id: 013
title: Student sees what to do today and the week grid
status: draft
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
