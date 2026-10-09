---
id: 012
title: Murad assigns a program after the placement test, the student starts it
status: done
---

# 012 — Murad assigns a program; the student presses «Начать»

**As the** owner
**I want** to assign a program to a student after I have tested their level
**so that** each student follows the path that fits their real level.

**As a** student
**I want** to see the program Murad assigned and start it when I'm ready
**so that** the countdown begins from the day I actually start.

## Data model

- `enrollments`: `student` relation; `program` relation (published only); `assignedAt` datetime; `placement` group, required on assign (D-SP-9):
  - `test` enum: Murad's test (CEFR), IELTS, TOEFL iBT, Cambridge, Duolingo English Test, PTE Academic, EF SET, Other;
  - `score`: IELTS 0–9 step 0.5; TOEFL iBT 0–120; Cambridge Scale 80–230 plus `exam` (KET, PET, FCE, CAE, CPE); Duolingo 10–160 step 5; PTE 10–90; EF SET 0–100; CEFR test — no score; Other — free text ≤40 plus `testName` ≤60;
  - `cefr` enum A1…C2, required (Murad enters it; no automatic conversion);
  - `takenAt` date, not in the future;
  - `note` ≤500, optional, owner only; `startDate` date, null until started; `timezone` IANA string, null until started; `status` assigned / active / paused / finished; `pauses` array {from date, to date nullable}.
- Constraint: at most one enrollment with status assigned, active or paused per student.
- Write: owner creates (assign), changes program while status = assigned, deletes; student only performs «start» on own enrollment (sets startDate, timezone, status). Read: owner all; student own, including her placement result, without `placement.note`.

## Acceptance criteria

1. `[happy]` **Given** the owner in `/admin` on a student's page **when** he enters the placement «IELTS 4.5, CEFR A2, 18.10.2026», selects published program A2 → B1 and saves **then** an enrollment with status assigned is created and the student gets an email «Мурад назначил тебе программу A2 → B1».
2. `[happy]` **Given** a student with an assigned enrollment **when** she opens `/study` **then** she sees her result «Тест: IELTS 4.5 · уровень A2» and the program card: level badge «A2 → B1», «52 недели», summary, materials, slots of the week template and a «Начать» button.
3. `[happy]` **Given** that card **when** she presses «Начать» and confirms «Начать A2 → B1 сегодня?» **then** startDate = today in her browser time zone, status = active, and she lands on «Сегодня» (013) with day 1.
4. `[happy]` **Given** a student without any enrollment **when** she opens `/study` **then** «Мурад назначит программу после теста уровня» is shown and nothing else.
5. `[edge]` **Given** the browser time zone cannot be detected **then** `Asia/Almaty` is used and shown as «Часовой пояс: Алматы (изменить)».
6. `[edge]` **Given** a student who already has an assigned, active or paused enrollment **when** the owner tries to assign another program **then** saving fails with «У ученика уже есть программа: <title>». While status = assigned the owner can change the program in place.
7. `[edge]` **Given** a double tap on «Начать» **then** startDate is set exactly once.
8. `[edge]` **Given** a finished enrollment **then** the owner can assign the next program; the old one stays in history.
9. `[edge]` **Given** a draft (unpublished) program **then** it is not offered in the assign selector.
10. `[edge]` **Given** an IELTS score of 9.5 or 4.3, a TOEFL score of 121, a Cambridge score without an exam, or a test date in the future **then** saving fails with a message naming the field and the allowed range.
11. `[edge]` **Given** placement CEFR B2 **when** the owner selects program A1 → A2 **then** a warning «Уровень по тесту (B2) выше программы» is shown, but saving is allowed.
12. `[edge]` **Given** the test is «Мурад (CEFR)» **then** the score field is hidden and only the CEFR level is required.
13. `[access]` **Given** a student **when** she calls the API to create an enrollment, change its program or placement, or read `placement.note` **then** 403 / field absent.
14. `[access]` **Given** anonymous **when** opening `/study` **then** redirect to `/login`.
15. `[edge]` **Given** the owner deletes a student **then** her enrollments are deleted with her (moved from 011; logs and comments are added by the stories that introduce them).

## Analytics

- `program_assigned` {programSlug, levelFrom, levelTo, placementTest, placementCefr}
- `program_started` {programSlug, levelFrom, levelTo, daysFromAssignToStart}
- No user data, never the exact score or `placement.note`.

## Out of scope

- The placement test itself on the site (Murad tests outside the site for now), automatic conversion of scores to CEFR, uploading certificates, history of several tests per student, student choosing a program, start on a future date, abandoning a program, the owner editing startDate.

## Notes

- Depends on 009, 011. Migration required. Decisions D-SP-3, D-SP-6, D-SP-9. Copying the plan on assign is story 018.
- Replaces the earlier draft «Student picks a program and presses Начать».

## Implementation notes

- Assigning happens in `/admin` → Users → the student → «Программы» (a join field; «Create new» presets the student)
  or directly in Enrollments. The owner may only set `status` to `finished`; starting is the student's.
- The «warning» of AC 11 fires when the placement CEFR is above the program's `levelFrom`.
- «Other»: `testName` is required, the free-text result (`scoreText`) is optional.
- The start date is computed on the server from the time zone the browser sends (never a date from the client).
  After «Начать» `/study` shows «Сегодня · День 1 из N»; the full day view is story 013.
- A program that has enrollments cannot be deleted (unpublish it instead): its FK is required.

## Verification

| #   | Test (file › name)                                                                                                                                          | Layer        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | `enrollments.int.spec.ts` › 1. › creates an assigned enrollment and emails «Мурад назначил тебе программу A2 → B1» · writes the email in «вы» …             | int          |
| 1   | `enrollment.e2e.spec.ts` › enters the placement, sees the warnings and assigns A2 → B1 · the program shows on the student's page …                          | e2e          |
| 2   | `enrollments.int.spec.ts` › 2/4. › shows the placement result and the program, never the note · `enrollment-shape.unit.spec.ts` › labels IELTS, Cambridge … | int, unit    |
| 2   | `enrollment.e2e.spec.ts` › sees the result and the card, presses «Начать» and lands on day 1                                                                | e2e          |
| 3   | `enrollments.int.spec.ts` › 3/7. › sets today in her zone, status active, day 1 — exactly once · `StartProgram.browser.spec.tsx` › 3. asks «Начать …»       | int, browser |
| 3   | `enrollment.e2e.spec.ts` › sees the result and the card, presses «Начать» and lands on day 1 · `enrollment-shape.unit.spec.ts` › 3/5. …                     | e2e, unit    |
| 4   | `enrollment.e2e.spec.ts` › 4. without a program she sees only the empty state · `enrollments.int.spec.ts` › shows nothing but the empty state …             | e2e, int     |
| 5   | `StartProgram.browser.spec.tsx` › 5. shows Almaty when the browser zone cannot be detected … · `enrollments.int.spec.ts` › 5. falls back to Almaty …        | browser, int |
| 6   | `enrollments.int.spec.ts` › 6/8. › refuses a second program and names the current one · lets the owner change the program while it is assigned …            | int          |
| 6   | `enrollment.e2e.spec.ts` › the program shows on the student's page; a second one is refused                                                                 | e2e          |
| 7   | `enrollments.int.spec.ts` › … exactly once · `StartProgram.browser.spec.tsx` › 7. a double tap sends one request                                            | int, browser |
| 8   | `enrollments.int.spec.ts` › assigns the next program once the previous one is finished; history stays                                                       | int          |
| 9   | `enrollments.int.spec.ts` › 9. refuses a draft program · `enrollment.e2e.spec.ts` › … (draft not offered in the selector)                                   | int, e2e     |
| 10  | `enrollments.int.spec.ts` › 10/12. › refuses IELTS 9.5 / 4.3, TOEFL 121, Cambridge without exam, a future date · `enrollment-shape.unit.spec.ts` › 10. …    | int, unit    |
| 11  | `enrollment.e2e.spec.ts` › … sees the warnings … · `enrollment-shape.unit.spec.ts` › 11. warns for B2 on A1 → A2 …                                          | e2e, unit    |
| 12  | `enrollment.e2e.spec.ts` › … (no score field for «Мурад (CEFR)») · `enrollments.int.spec.ts` › needs only the CEFR level for Murad's test …                 | e2e, int     |
| 13  | `enrollments.int.spec.ts` › 13. access › cannot create · cannot change program or placement (403) · cannot backdate · reads own without the note · …        | int          |
| 13  | `enrollments.int.spec.ts` › integrity › a student cannot filter by the private note                                                                         | int          |
| 14  | `student.e2e.spec.ts` › /study sends a signed-out visitor to /login · `enrollments.int.spec.ts` › an anonymous caller reads nothing                         | e2e, int     |
| 15  | `enrollments.int.spec.ts` › 15. deleting a student › deletes her enrollments with her                                                                       | int          |
