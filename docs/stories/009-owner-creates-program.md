---
id: 009
title: Murad creates slot types and a study program with a week template
status: approved
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
