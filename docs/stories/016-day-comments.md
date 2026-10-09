---
id: 016
title: Student comments on a day, Murad reads the comments
status: done
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

## Verification

| #   | Test (file › name)                                                                                                                         | Layer   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 1   | `day-comments.int.spec.ts` › 1. a comment on today and on a past day is stored for her own enrollment                                      | int     |
| 1   | `DayComment.browser.spec.tsx` › 1. an empty day shows the field and saves the text for that date                                           | browser |
| 1   | `day-comments.e2e.spec.ts` › 1/3/4/5. write, replace, clear, too long … (saved, shown after a reload, a past day via `?day=9`)             | e2e     |
| 2   | `day-comments.int.spec.ts` › 2. the owner sees student name, program, program day, date and text; filters by student                       | int     |
| 2   | `day-comments.e2e.spec.ts` › 2/6. Murad reads the list newest first and filters by student …                                               | e2e     |
| 3   | `day-comments.int.spec.ts` › 3. saving again replaces the text; empty text deletes the comment · 3. two saves at once leave one            | int     |
| 3   | `DayComment.browser.spec.tsx` › 3. an existing comment is prefilled; clearing it saves an empty text                                       | browser |
| 3   | `day-comments-schema.unit.spec.ts` › 3. empty or blank text is valid (it deletes the comment)                                              | unit    |
| 4   | `day-comments-schema.unit.spec.ts` › 4. 1000 characters pass, 1001 do not                                                                  | unit    |
| 4   | `day-comments.int.spec.ts` › 4. 1001 characters are refused, 1000 are stored                                                               | int     |
| 4   | `DayComment.browser.spec.tsx` › 4. 1001 characters show «Не больше 1000 символов» and nothing is sent                                      | browser |
| 4   | `day-comments.e2e.spec.ts` › 1/3/4/5 … («Не больше 1000 символов», stored text unchanged)                                                  | e2e     |
| 5   | `day-comments.int.spec.ts` › 5. a future day and a day before the start are refused · 5. no program · 5. API: a student cannot write (403) | int     |
| 5   | `day-comments.e2e.spec.ts` › 1/3/4/5 … (`?day=11`: no comment field) · 2/6 … (REST `POST` by a student → 403)                              | e2e     |
| 6   | `day-comments.int.spec.ts` › 6. another student sees none of it; anonymous is refused                                                      | int     |
| 6   | `day-comments.e2e.spec.ts` › 2/6 … (another student's REST list has no foreign text; anonymous → 403)                                      | e2e     |
