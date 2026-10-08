---
id: 011
title: Murad invites a student, the student signs in by email code
status: draft
---

# 011 — Murad invites a student; the student signs in by email code

**As the** owner
**I want** to add a student by email
**so that** only my students get into the study tracker.

**As a** student
**I want** to sign in with a code from email, without a password
**so that** I can open my plan from any device.

## Data model
- `users`: add role `student` (existing role: owner). Fields: `email` unique, required; `name` ≤80; `invitedAt` datetime; `locale` ru/en, default ru; `addressForm` ty / vy, default ty (D-SP-8).
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
10. `[edge]` **Given** the owner deletes a student **then** her sessions end and her enrollments, logs and comments are deleted (confirmation dialog in admin).

## Out of scope
- Public sign-up, OAuth, passwords, self-learners, payment.
- Converting Murad's own task texts between «ты» and «вы» — he writes them as he likes.

## Notes
- D-SP-1 accepted; D-SP-2 (code limits, session length) still needs the owner's OK. The PR also updates `docs/product.md` («аккаунты учеников — только по приглашению»). Security review by Claude Code is mandatory.
- Analytics: none with email.
