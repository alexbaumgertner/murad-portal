---
id: 009
title: Murad creates slot types and a study program with a week template
status: done
---

# 009 — Murad creates slot types and a study program with a week template

**As the** owner
**I want** to define activity types and build a program from a single week template
**so that** students get a ready plan instead of a hand-copied spreadsheet.

## Data model

- `slot-types`: `name` {ru, en} required, ≤60; `description` {ru, en} ≤500; `defaultMinMinutes` int 1–240, default 20. Write: owner. Read: owner, authenticated students.
- `programs`: `slug` unique, `[a-z0-9-]` ≤60; `title` {ru, en} required ≤80; `levelFrom`, `levelTo` enum A1, A2, B1, B2, C1 (C2 allowed only as `levelTo`), `levelFrom` < `levelTo`; `durationWeeks` int 1–104, default 52; `summary` {ru, en} ≤1000; `materials` {ru, en} rich text; `weekTemplate` array of exactly 7 days, each with 0–5 slots `{slotType (relation, required), minMinutes int 1–240, optional — falls back to slotType.defaultMinMinutes}`; `status` enum draft / published, default draft.
- Write: owner. Read: owner; authenticated students only `published`.

## Acceptance criteria

1. `[happy]` **Given** the owner in `/admin` **when** he creates slot type «Anki» with 20 min **then** it is saved and available in the program editor.
2. `[happy]` **Given** slot types exist **when** the owner creates program A2→B1, 52 weeks, day 1 = [Anki 20, Сериал 40], day 4 = [] **then** the program is saved as draft with 7 template days, day 4 empty.
3. `[edge]` **Given** a program form **when** levelFrom = B2 and levelTo = B1 **then** saving fails with «Начальный уровень должен быть ниже целевого».
4. `[edge]` **Given** a template day **when** the owner adds a 6th slot **then** saving fails with «В дне не больше 5 занятий».
5. `[edge]` **Given** a slot with minMinutes 0 or 241 **when** saving **then** it fails with a range message 1–240.
6. `[edge]` **Given** a slot type used in any program **when** the owner deletes it **then** deletion is refused with «Тип используется в программах: <titles>».
7. `[edge]` **Given** two programs **when** the second gets the same slug **then** saving fails with «Такой адрес уже занят».
8. `[access]` **Given** an anonymous request or a student **when** they call create/update on `programs` or `slot-types` **then** the API returns 403; anonymous read of `programs` returns nothing.
9. `[access]` **Given** a student **when** listing programs **then** only `published` ones are returned.

## Out of scope

- Assignments per week/day (010), student UI (012–013), program builder for students, publishing a public catalog.

## Notes

- Migration required; owner reads it before merge.
- Seed (dev/test only): slot types «Anki», «Сериал», «FMA», «30 слов», one program B1→B2 based on the reference spreadsheet.

## Verification

| #   | Test (file › name)                                                                                                                                    | Layer |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | `programs.int.spec.ts` › 1. the owner creates a slot type › saves «Anki» with 20 minutes and offers it to programs · defaults the minimum to 20 …     | int   |
| 1   | `programs.e2e.spec.ts` › Murad creates a slot type and picks it in a program week template                                                            | e2e   |
| 2   | `programs.int.spec.ts` › 2. … › saves A2→B1, 52 weeks, as a draft with 7 template days and day 4 empty · starts every new program with 7 empty days … | int   |
| 2   | `programs.e2e.spec.ts` › Murad creates a slot type and picks it in a program week template (saves the draft with 7 days)                              | e2e   |
| 3   | `programs.int.spec.ts` › 3. levels › rejects levelFrom B2 with levelTo B1 · rejects equal levels, and a partial update that breaks the order          | int   |
| 3   | `programs.e2e.spec.ts` › refuses a program whose start level is not below the target                                                                  | e2e   |
| 3   | `program-shape.unit.spec.ts` › orders CEFR levels strictly                                                                                            | unit  |
| 4   | `programs.int.spec.ts` › 4. at most 5 slots a day › rejects a 6th slot                                                                                | int   |
| 5   | `programs.int.spec.ts` › 5. slot minutes › rejects minMinutes 0 / 241 with the 1–240 message · accepts 1 / 240                                        | int   |
| 6   | `programs.int.spec.ts` › 6. a used slot type cannot be deleted › refuses with the titles of the programs that use it · deletes an unused slot type    | int   |
| 7   | `programs.int.spec.ts` › 7. the slug is unique › rejects a second program with the same slug · lets a program keep its own slug on update             | int   |
| 8   | `programs.int.spec.ts` › 8. access › a student and an anonymous caller cannot create or update (or delete) programs / slot-types (403)                | int   |
| 8   | `programs.int.spec.ts` › 8. access › an anonymous request reads no programs · cannot read slot types · a student can read slot types                  | int   |
| 9   | `programs.int.spec.ts` › 9. students see only published programs › lists published programs and hides drafts, also by id                              | int   |
