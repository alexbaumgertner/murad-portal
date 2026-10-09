---
id: 018
title: Each student gets a personal plan copied from the program, which Murad can edit
status: done
---

# 018 — Personal plan per student

**As the** owner
**I want** each student's plan to start as a copy of the program's default plan and then be mine to change for that student
**so that** I can give individual tasks without rebuilding the whole year.

**As a** student
**I want** to see my tasks for today and for future weeks
**so that** I can plan ahead.

## Data model

- `student-assignments`: `enrollment` relation; `week`, `day`, `order` (same ranges as 010); `text` {ru required, en optional} ≤1000 — a copy, not a link; `sourceTask` relation → `task-pool`, nullable (null = custom task); `editedByOwner` bool. Unique (enrollment, week, day, order).
- Write: owner. Read: owner; student — own enrollment, all weeks (Q7: the future is visible).

## Acceptance criteria

1. `[happy]` **Given** the owner assigns program B1 → B2 to a student (012) **then** all plan items of that program are copied into her `student-assignments` with the pool text at that moment.
2. `[happy]` **Given** a student's page in `/admin` **when** the owner opens «План ученика» **then** he sees the same week × day grid as in 010, with copied tasks marked «из пула» and custom ones «своё».
3. `[happy]` **Given** that grid **when** the owner replaces week 3, day 2 with another pool task of an allowed level, or writes a custom text **then** only this student's plan changes; `editedByOwner = true`.
4. `[happy]` **Given** a student on day 10 **when** she opens «Все недели» and any future week **then** she sees that week's tasks (read-only).
5. `[edge]` **Given** the program default plan changes after assignment **then** existing students' plans do not change.
6. `[edge]` **Given** the owner deletes a task on a day the student already completed **then** the task disappears, but the day's slot logs and comment stay.
7. `[edge]` **Given** an empty program plan **when** assigning **then** the student's plan is empty and «На этой неделе заданий нет» is shown to her.
8. `[edge]` **Given** the owner adds a 4th task to a day **then** «В дне не больше 3 заданий».
9. `[access]` **Given** a student **when** she requests another student's assignments or tries to write any **then** 403.

## Out of scope

- Students editing tasks, task submissions (answers, files), grading, re-syncing a student's plan with the program plan.

## Notes

- Depends on 010, 012. Migration required. 013 shows these tasks.
- If the copy in item 1 is heavy (52 × 7 × 3 rows max ≈ 1 100), run it in one transaction; e2e test asserts the count.

## Implementation notes

- The copy runs in the `enrollments` `afterChange` hook on the assignment's `req` (one transaction):
  if one row fails, the assignment is rolled back and no email is sent. A full year (1 092 tasks)
  copies in about 3 s locally. Changing the program while it is still `assigned` replaces the copy.
- The copy holds the text (`text.ru`/`text.en`), not a link: later edits of the pool or the default
  plan never reach it (D-SP-5). Deleting a pool task only clears `sourceTask` on copies (they show «своё»).
- Owner edits (in `/admin`): picking another pool task copies its text; changing the text, or
  clearing «Из пула», makes the task «своё» (`sourceTask` = null). Every owner write sets
  `editedByOwner`. Ranges, levels, ≤3 a day and unique places follow 010's rules and messages.
- «План ученика» is a grid on the student's page (Users → ученик) for her open program (else the
  last finished one); each task opens its editor, «Добавить задание» opens a new one.
- The student reads her plan on `/study/weeks` («Все недели», linked from «Сегодня»): weeks 1…N, the
  current one marked, any week read-only, `?week=N`. 013 builds the full day view on top.
- AC 9: a student's list never contains other students' tasks and opening one by id is refused
  (404, as in 012: it does not reveal that the task exists); every write is 403.
- AC 6: slot logs and comments do not exist yet (015, 016); deleting a task removes only that task.
- `text.ru` is required by the hook, not by the field, so the admin form accepts a pool task
  before its text is copied.

## Verification

| #   | Test (file › name)                                                                                                                         | Layer     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| 1   | `student-plan.int.spec.ts` › 1. › copies every plan item with the pool text at that moment · rolls the assignment back when the copy fails | int       |
| 1   | `student-plan.int.spec.ts` › 1. › replaces the plan when the owner changes the program before the start · copies a full year (52 × 7 × 3)  | int       |
| 1   | `student-plan.e2e.spec.ts` › 1. assigning copies all 8 plan items into her plan                                                            | e2e       |
| 2   | `student-plan.e2e.spec.ts` › 2/3. «План ученика» shows the grid; a custom text turns a task into «своё»                                    | e2e       |
| 3   | `student-plan.int.spec.ts` › 3. › replaces a task with another pool task of an allowed level · writing a custom text makes the task «своё» | int       |
| 3   | `student-plan.int.spec.ts` › 3. › adds a pool task … · refuses a pool task outside the program levels · refuses week 53 and day 8 · …      | int       |
| 3   | `student-plan-shape.unit.spec.ts` › 3. a new pool task wins, a changed text makes the task «своё» · `student-plan.e2e.spec.ts` › 2/3.      | unit, e2e |
| 4   | `student-plan.int.spec.ts` › 4/7. › sees a future week’s tasks on day 10 · reads the English text … · opens the current week by default    | int       |
| 4   | `student-plan.e2e.spec.ts` › 4/7. opens a future week read-only; an empty week says so · `student-plan-shape.unit.spec.ts` › 4.            | e2e, unit |
| 5   | `student-plan.int.spec.ts` › 5. › do not change existing students’ plans                                                                   | int       |
| 6   | `student-plan.int.spec.ts` › 6. › removes only that task; the enrollment and the rest stay                                                 | int       |
| 7   | `student-plan.int.spec.ts` › 7. an empty program plan gives an empty personal plan · `student-plan.e2e.spec.ts` › 4/7. (empty week)        | int, e2e  |
| 7   | `student-plan-shape.unit.spec.ts` › 7. lays one week out as 7 days, empty days included                                                    | unit      |
| 8   | `student-plan.int.spec.ts` › 8. › refuses a 4th task · refuses a taken place                                                               | int       |
| 9   | `student-plan.int.spec.ts` › 9. › reads her own plan and nobody else’s · cannot write any task (403) · an anonymous caller reads nothing   | int       |
| —   | `student-plan.int.spec.ts` › integrity › deleting an enrollment or the student deletes her plan                                            | int       |
