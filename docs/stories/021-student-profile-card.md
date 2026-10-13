---
id: 021
title: Student sees her own card and a student header, not the teacher's menu
status: done
---

# 021 — Student profile card and student header

**As a** student
**I want** to see on `/study` that I am signed in (my name, email, photo) and my level, goal and start date
**so that** I know it is my account and what Murad set up for me — without the teacher's site menu getting in the way.

## Data model (needs a migration)

- `users.level` — select A1 / A2 / B1 / B2 / C1 / C2 (reuse `LEVELS`), optional. `users.goal` — text ≤200, optional. Write: **owner only** (field access `ownerOnly`, like `role`); the student reads her own.
- `users.avatar` — upload relation to a new collection `avatars` (image/jpeg|png|webp, ≤2 MB, one per user, file stored like `media`: Vercel Blob in prod, local without the token). A student may create/replace/delete **only her own** avatar; the owner may do anything; read: the owner and the student herself (not public).
- «Start date» is not stored: it is `placement.takenAt` of the student's latest enrollment (the day Murad tested her level).

## Acceptance criteria

1. `[happy]` **Given** a signed-in student **when** she opens `/study` **then** the first block is her card: avatar, name, email, level, goal, «С нами с `date`» (date of the level test), above «Привет, …» and the rest as today.
2. `[happy]` **Given** a signed-in student **when** she opens any `/study/*` page **then** the header shows the logo, a link to her `/study`, her name (email if no name), «Выйти» and the EN/RU switch — and **no** «Обо мне / Подход / Материалы / Экзамены / FAQ / Челлендж / Войти».
3. `[happy]` **Given** a signed-out visitor **when** opening `/` or `/challenge` **then** the header is unchanged («Войти» included).
4. `[edge]` **Given** a student without avatar **then** a circle with the initials of her name (or the email's first letter) is shown.
5. `[edge]` **Given** no level / goal / enrollment **then** those rows are hidden (no «undefined», no empty labels); the card still shows name and email.
6. `[edge]` **Given** locale `en` **or** addressForm `vy` **then** card labels follow the locale and the «вы» form like the rest of the student UI.
7. `[happy]` **Given** a student on `/study/settings` **when** she uploads a JPEG/PNG/WebP ≤2 MB **then** the card shows it right after saving; she can also remove it.
8. `[edge]` **Given** a file over 2 MB or not an image **when** she uploads **then** an error code is shown as a translated message and nothing is stored.
9. `[access]` **Given** a student **when** she sets `level` or `goal` via the API/settings **then** 403 / field ignored.
10. `[access]` **Given** a student **when** she requests another student's avatar or replaces it **then** 403 / not found; an anonymous request gets 403.
11. `[happy]` **Given** the owner in `/admin` **when** he edits a student **then** he can set `level` and `goal` there.
12. `[edge]` **Given** the owner opens `/study/students/*` **then** he keeps the current full header (it is his tool, not the student's).
13. `[edge]` **Given** a student **when** the 360px width **then** the card and header do not overflow (header collapses to logo + name + «Выйти»).

## Out of scope

- Avatar crop/resize editor; email/name change by the student; showing the card to anyone but the student and the owner.
- Redesign of the home page header for signed-in visitors outside `/study`.

## Notes for implementation

- The header lives in `[locale]/layout.tsx` for every page. Plan: a route-group split so `/study/*` gets a `StudentHeader` (server component reading the session), the public pages keep `SiteHeader`. The `study/students/*` owner pages keep `SiteHeader`.
- Changes `src/collections/` → a migration, and a sequential PR. Likely ~350 changed lines; if it goes over 400 split: **021a** model + admin fields + card, **021b** header, **021c** avatar upload.

## Verification

| #   | Test (file › name)                                                                                                                                   | Layer          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1   | `tests/int/student-card.int.spec.ts` › shows name, email, level, goal and the date of the level test                                                 | int            |
| 1   | `tests/e2e/student-card.e2e.spec.ts` › shows name, level, goal and the start date Murad set; follows the language                                    | e2e            |
| 2   | `tests/e2e/student-card.e2e.spec.ts` › a student sees her name and sign out, and none of the teacher menu                                            | e2e            |
| 3   | `tests/e2e/student-card.e2e.spec.ts` › a signed-out visitor keeps the public header                                                                  | e2e            |
| 4   | `tests/unit/student-card-shape.unit.spec.ts` › initialsOf; e2e › …initials and no empty rows for a fresh student                                     | unit, e2e      |
| 5   | `tests/int/student-card.int.spec.ts` › has no level, goal, date or avatar…; e2e › fresh student                                                      | int, e2e       |
| 6   | e2e › …follows the language (`/en/study`); «вы» labels: `tests/browser/AvatarForm.browser.spec.tsx` › translates an error code, in «вы» too          | e2e, browser   |
| 7   | `tests/int/student-card.int.spec.ts` › stores a PNG…, removes it again; e2e › uploads a photo, shows it on the card and removes it again             | int, e2e       |
| 8   | `tests/unit/student-card-shape.unit.spec.ts` › avatarError; int › refuses a file over 2 MB and a non-image; e2e › a PDF and a 3 MB image are refused | unit, int, e2e |
| 9   | `tests/int/student-card.int.spec.ts` › a student’s own write to them is dropped                                                                      | int            |
| 10  | `tests/int/student-card.int.spec.ts` › nobody else reads or changes her avatar (4 tests)                                                             | int            |
| 11  | `tests/int/student-card.int.spec.ts` › the owner sets them                                                                                           | int            |
| 12  | `tests/e2e/student-card.e2e.spec.ts` › the owner keeps the full public header on /study/students                                                     | e2e            |
| 13  | `tests/e2e/student-card.e2e.spec.ts` › does not overflow at 360px                                                                                    | e2e            |
