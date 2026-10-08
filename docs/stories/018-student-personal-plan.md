---
id: 018
title: Each student gets a personal plan copied from the program, which Murad can edit
status: approved
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
