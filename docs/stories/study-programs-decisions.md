# Decisions for the Study Programs epic

Accepted by the owner on Oct 8, 2026: D-SP-1 to D-SP-9 (all). To be moved into `docs/decisions.md` when the epic is merged.

## D-SP-1 — Student accounts (changes product.md)

**Status:** accepted
**Was:** «Не делаем аккаунты учеников, оплату, курсы, комментарии.»
**Becomes:** Murad's students have accounts, invite-only. No public sign-up, no payment. Students can comment on their own study days (comments are private: student + owner).
**Consequence:** new Payload role `student` in `users`; access control must deny students `/admin` and any other student's data.

## D-SP-2 — Sign-in by one-time email code

**Status:** accepted
Students sign in like the owner (code from email), on the public site, not in `/admin`. Code: 6 digits, valid 10 minutes, max 5 attempts, max 3 codes per email per 15 minutes. Session: 30 days.

## D-SP-3 — Program day is relative to the start

**Status:** accepted
Day 1 of the template is the day the student pressed «Начать», in her time zone (from the browser, editable). Missed days are marked, the program does not shift. Paused days do not count.

## D-SP-4 — Timer state lives on the server

**Status:** accepted
Starting a timer saves `timerStartedAt`; elapsed = now − timerStartedAt + saved minutes. Closing the tab does not lose time. One running timer per student. A timer running over 4 hours is stopped and counted as 240 minutes.

## D-SP-5 — Personal plans built from a shared task pool

**Status:** accepted (replaces «content is common per program»)
Murad keeps a pool of tasks tagged by CEFR level. Each program has a default plan made of pool tasks (week, day, up to 3 per day). When a program is assigned, the default plan is **copied** into the student's personal plan; from then on Murad edits it per student. Later edits of the pool or the program plan do not change existing students' plans.

## D-SP-6 — Murad assigns the program after a placement test

**Status:** accepted
Students do not choose a program. Murad tests the level (outside the site for now), records the result and assigns one program in `/admin`. The student then presses «Начать». One assigned/active/paused program per student at a time; the next one is also assigned by Murad.

## D-SP-7 — A slot counts as done only at the minimum time

**Status:** accepted
A slot is `completed` only when its minutes reach the minimum. Less time is saved and shown («25 из 40 мин»), but the slot stays not done. A day is done (✓) only when all its slots are done.

## D-SP-8 — «Ты» or «вы» is the student's setting

**Status:** accepted
Each student chooses how the interface addresses her: «ты» (default) or «вы». Every Russian student-facing text exists in both forms (ru-ty, ru-vy) plus English. The owner can preset the form when inviting. Murad's own task texts are shown as he wrote them. The owner's admin stays as is.

## D-SP-9 — Placement result in the format of common tests

**Status:** accepted
The placement result is stored on the enrollment as: test (Murad's CEFR test, IELTS, TOEFL iBT, Cambridge, Duolingo English Test, PTE Academic, EF SET, Other), score in that test's own scale, CEFR level (entered by Murad, no automatic conversion), test date, private note. The student sees her own result, never the note.

## Also decided (no separate record needed)

- Manual marking of past days is allowed (Q5).
- Pauses have no length or count limit (Q6).
- Students see future weeks' slots and tasks (Q7).
