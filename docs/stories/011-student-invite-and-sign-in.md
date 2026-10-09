---
id: 011
title: Murad invites a student, the student signs in by email code
status: approved
---

# 011 — Murad invites a student; the student signs in by email code

**As the** owner
**I want** to add a student by email
**so that** only my students get into the study tracker.

**As a** student
**I want** to sign in with a code from email, without a password
**so that** I can open my plan from any device.

## Data model

- `users`: add field `role` — select `owner` | `student`, required, default `owner`; the migration sets every existing user to `owner` so nobody loses admin access. Only the owner can change `role`. Fields: `email` unique, required; `name` ≤80; `invitedAt` datetime; `locale` ru/en, default ru; `addressForm` ty / vy, default ty (D-SP-8).
- Login codes: reuse the owner's mechanism; limits per D-SP-2.
- Write: owner creates/deletes students and may preset `addressForm`; student edits own `name`, `locale`, `addressForm`. Read: owner all; student only own record.

## Acceptance criteria

1. `[happy]` **Given** the owner in `/admin` **when** he adds student `anna@example.com` **then** the user is created with role student and an invite email is sent: «Мурад пригласил тебя в трекер учёбы» with a link to `/login`.
2. `[happy]` **Given** an invited student on `/login` **when** she enters her email and the 6-digit code **then** she lands on `/study`, session lasts 30 days.
3. `[edge]` **Given** an email that is not invited **when** requesting a code **then** the page shows the same neutral message as for invited ones («Если адрес есть в списке, код уже в почте») and no email is sent.
4. `[edge]` **Given** a code older than 10 minutes or 5 wrong attempts **when** entering it **then** «Код устарел, запроси новый» and the code is invalid.
5. `[edge]` **Given** 3 codes requested in 15 minutes **when** requesting a 4th **then** «Слишком много попыток, подожди 15 минут».
6. `[access]` **Given** a signed-in student **when** opening `/admin` **then** she is redirected to `/study` (no admin access).
7. `[access]` **Given** a student **when** requesting another user's record via API **then** 403.
8. `[happy]` **Given** a signed-in student on `/study/settings` **when** she picks «Обращаться на „вы“» and saves **then** all student-facing interface texts switch to the «вы» form on the next render (e.g. «Начни» → «Начните»); the invite and code emails use the form preset by the owner, or «ты» if none.
9. `[edge]` **Given** `addressForm` = vy **and** locale = en **then** English texts are unchanged.
10. `[edge]` **Given** the owner deletes a student **then** her sessions end (confirmation dialog in admin). Deleting her enrollments, logs and comments moves to 012 and later stories, which introduce those collections.

## Split into PRs

- **011a** — `users.role`, `name`, `invitedAt`, `locale`, `addressForm`, owner/student access, migration: criteria 6–7 at API level, 10 (sessions end, confirmation).
- **011b** — student sign-in on `/login`, `/study`, code limits, invite email: criteria 1–5, 6 as a redirect.
- **011c** — «ты»/«вы» and `/study/settings`: criteria 8–9.
- The cascade delete of enrollments, logs and comments is added in 012 (enrollments) and in the stories that add logs and comments.

## Out of scope

- Public sign-up, OAuth, passwords, self-learners, payment.
- Converting Murad's own task texts between «ты» and «вы» — he writes them as he likes.

## Notes

- D-SP-1 and D-SP-2 accepted (Oct 8, 2026). The PR also updates `docs/product.md` («аккаунты учеников — только по приглашению»). Security review by Claude Code is mandatory.
- Analytics: none with email.

## Verification

### 011a — roles, user fields, access (this PR)

| #   | Test (file › name)                                                                                                                                           | Layer        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 6   | `tests/int/user-roles.int.spec.ts` › `has no admin panel access, the owner has`; `is not an admin for the site (currentAdmin)`                               | int          |
| 7   | `tests/int/user-roles.int.spec.ts` › `cannot read another user's record, only her own`; `cannot update or delete another user's record`                      | int          |
| 10  | `tests/int/user-roles.int.spec.ts` › `ends her session: the cookie stops authenticating`; confirmation dialog: Payload's built-in delete modal, manual check | int / manual |
| —   | data model, owner powers, self-service limits, no owner powers over other collections (same file)                                                            | int          |

Notes: Payload ignores writes to a field the caller may not touch (`role`, `invitedAt`), so a student's attempt to promote herself is a no-op, not an error; changing her own `email` is rejected. Reading another user's record returns "not found" (404) rather than 403 through the Local API.

### 011b — student sign-in, `/study`, code limits, invite email (this PR)

| #   | Test (file › name)                                                                                                                                                                                                                                                                                                                                                                  | Layer                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | `tests/int/student-sign-in.int.spec.ts` › `creates a student and emails an invite with a link to /login`; `always creates a student, whatever role the form sends`; `does not invite an address that already has an account…`; `refuses a student or a signed-out visitor`; `leaves no account behind when the invite email cannot be sent`; `tests/unit/invite-email.unit.spec.ts` | int / unit           |
| 2   | `tests/int/student-sign-in.int.spec.ts` › `lands on /study with a 30-day session`; `keeps the language of the login page`; `tests/unit/session.unit.spec.ts` › `lasts 7 days for the owner and 30 days for a student`; `tests/e2e/student.e2e.spec.ts` › `an invited student signs in on /login, lands on /study…`                                                                  | int / unit / e2e     |
| 3   | `tests/int/student-sign-in.int.spec.ts` › `gets the same answer as an invited one, and no email`; `tests/e2e/student.e2e.spec.ts` › `an address that was not invited gets the same neutral answer`                                                                                                                                                                                  | int / e2e            |
| 4   | `tests/int/student-sign-in.int.spec.ts` › `is reported as expired after 5 wrong attempts and stops working`; `tests/unit/otp.unit.spec.ts` › `rejects expired codes`, `burns the code after 5 wrong attempts…`; `tests/browser/StudentLogin.browser.spec.tsx` › `translates code_expired`                                                                                           | int / unit / browser |
| 5   | `tests/int/student-sign-in.int.spec.ts` › `refuses a 4th code within 15 minutes`; `tests/unit/otp.unit.spec.ts` › `limits codes per email`; `tests/browser/StudentLogin.browser.spec.tsx` › `translates rate_limited`                                                                                                                                                               | int / unit / browser |
| 6   | `tests/e2e/student.e2e.spec.ts` › `…cannot open /admin` (redirect to `/study`); `ignores a redirect target for a student` (int)                                                                                                                                                                                                                                                     | e2e / int            |

Notes: the owner invites from "Invite a student" above the Users list in `/admin`; the flow reads only email and
name and always creates `role: 'student'`. Any student creation (also via "Create new" with role Student) stamps
`invitedAt` and sends the invite in the same transaction — a failed email rolls the account back. The invite holds
only a link to `/login` (no code or token). Emails and `/login` use the «ты» form; «вы» comes in 011c.
`otp.ts` now returns error codes (`rate_limited`, `wrong_code`, `code_expired` …) instead of English sentences;
the admin login maps them to its old English copy.
