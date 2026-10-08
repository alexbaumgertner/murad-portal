---
id: 016
title: Student comments on a day, Murad reads the comments
status: approved
---

# 016 — Day comments

**As a** student
**I want** to leave a comment on a day (a question, what was hard)
**so that** Murad sees it before our lesson.

**As the** owner
**I want** to see students' comments in one place
**so that** I prepare for lessons without asking each student.

## Data model
- `day-comments`: `enrollment` relation; `date` date; `text` ≤1000, required. Unique (enrollment, date).
- Write: student own, today or past days of the enrollment. Read: owner; student own. Never public.

## Acceptance criteria
1. `[happy]` **Given** today or a past day **when** the student writes «Не понял Present Perfect в серии 3» and saves **then** it is stored and shown under the day.
2. `[happy]` **Given** comments exist **when** the owner opens «Комментарии учеников» in `/admin` **then** he sees a list newest first: student name, program, program day, date, text; filter by student.
3. `[edge]` **Given** an existing comment **when** the student saves again **then** the text is replaced; empty text deletes the comment.
4. `[edge]` **Given** 1001 characters **then** «Не больше 1000 символов».
5. `[edge]` **Given** a future day **then** no comment field; API 403.
6. `[access]` **Given** another student or anonymous **then** the comment is not readable (403 / not returned).

## Analytics
- None (comment text must never go to analytics).

## Out of scope
- Murad replying on the site, notifications about new comments, attachments.

## Notes
- Depends on 013. Migration required. Changes product.md («не делаем комментарии») — covered by D-SP-1 (accepted).
