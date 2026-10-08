# Epic: Study Programs («Учебные программы»)

Status: approved · Oct 8, 2026 · source: owner + Murad answers in chat

## Goal

Murad's students follow a study program (for example A2 → B1) instead of a hand-copied Google Sheet. Murad tests a student's level, assigns a program, and the student gets a personal plan built from Murad's task pool. The student presses «Начать», and from that day the site shows what to do today, runs a timer for each activity, and keeps the history: done, missed, paused.

Later (not in this epic): self-learners, paid subscription (trial and/or freemium), a program builder, an AI roadmap, reminders.

## Roles

| Role | Who | Can do |
| --- | --- | --- |
| Owner (Murad) | Teacher | Creates slot types, programs with a week template, a task pool by level and each program's default plan; invites students; records the placement test and assigns a program; edits each student's personal plan; reads all progress and comments |
| Student | Murad's student, invited by him | Signs in by email code, chooses «ты»/«вы», starts the assigned program, sees all weeks, runs timers, marks past days, comments, pauses |
| Visitor | Anyone | Nothing in this epic (no public catalog yet) |

## Key terms

- **Program** — a path from one CEFR level to the next (A1→A2 … B2→C1), N weeks long (default 52).
- **Week template** — 7 program days; each day has 0–5 **slots**. Every week uses the same template.
- **Slot** — the type of activity (e.g. «Anki», «Сериал», «Чтение») with a minimum time in minutes. Done only when the minimum is reached.
- **Task pool** — Murad's reusable text tasks, each tagged with a CEFR level.
- **Default plan** — pool tasks placed on (week, day) of a program, up to 3 per day.
- **Personal plan** — a copy of the default plan made when the program is assigned; Murad edits it per student.
- **Placement** — the result of the level test: test type, score in its own scale, CEFR level, date, private note.
- **Program day** — day 1 is the day the student pressed «Начать», in her time zone. Paused days do not count.
- **Materials** — textbooks and resources Murad writes into the program description.

## Data model (overview)

| Collection | Main fields | Write | Read |
| --- | --- | --- | --- |
| `slot-types` | name {ru,en} ≤60, description {ru,en} ≤500, defaultMinMinutes 1–240 (default 20) | owner | owner, students |
| `programs` | slug (unique), title {ru,en} ≤80, levelFrom/levelTo (from < to), durationWeeks 1–104 (default 52), summary {ru,en} ≤1000, materials {ru,en} rich text, weekTemplate (7 days × 0–5 slots: slotType, minMinutes 1–240), status draft/published | owner | owner; students — published |
| `task-pool` | level A1…C2, title ≤80, text {ru req, en} ≤1000, slotType (optional) | owner | owner |
| `program-plan-items` | program, week, day 1–7, order 1–3, task → task-pool (level within program range); unique (program, week, day, order) | owner | owner |
| `users` (role `student`) | email (unique), name ≤80, invitedAt, locale ru/en, addressForm ty/vy (default ty) | owner; student — own name, locale, addressForm | owner; student — own |
| `enrollments` | student, program, assignedAt, placement {test, score, exam, cefr, takenAt, note}, startDate (null until start), timezone, status assigned/active/paused/finished, pauses [{from, to}]; at most one assigned/active/paused per student | owner (assign); student — start, pause/resume own | owner; student — own, without placement.note |
| `student-assignments` | enrollment, week, day, order 1–3, text {ru req, en} ≤1000 (copy), sourceTask (nullable), editedByOwner | owner | owner; student — own, all weeks |
| `slot-logs` | enrollment, date, slotIndex 0–4, slotType (snapshot), minutes 0–600, completed, timerStartedAt; unique (enrollment, date, slotIndex) | student — own | owner; student — own |
| `day-comments` | enrollment, date, text ≤1000; unique (enrollment, date) | student — own | owner; student — own |

### Program day calculation

`dayIndex = (today in enrollment.timezone − startDate) − pausedDaysBefore(today) + 1`
`week = ceil(dayIndex / 7)`, `templateDay = ((dayIndex − 1) mod 7) + 1`.
Program is finished when `dayIndex > durationWeeks × 7`.

### Day states (never by colour alone)

| State | Rule | Marker besides colour |
| --- | --- | --- |
| done | all slots of the day reached their minimum | ✓ |
| partial | some time logged, not all slots done | ½ |
| missed | past day, no slot done | ✕ |
| today | current program day | outline + «Сегодня» |
| paused | calendar day inside a pause | ‖ |
| rest | template day has 0 slots | «—» |
| upcoming | future | empty |

### Texts

Every student-facing Russian text exists in two forms, «ты» and «вы» (D-SP-8), plus English. Stories list texts in the «ты» form; the «вы» form is written in the same PR.

## Stories

| # | User gets | Executor | Depends on |
| --- | --- | --- | --- |
| 009 | Murad creates slot types and a program with a week template | Claude Code | 011 (role `student`) |
| 010 | Murad keeps a task pool by level and builds each program's default plan | Claude Code | 009 |
| 011 | Murad invites a student; sign-in by email code; «ты»/«вы» setting | Claude Code | D-SP-2 (first in order: adds `users.role`) |
| 012 | Murad records the placement test and assigns a program; the student presses «Начать» | Claude Code | 009, 011 |
| 018 | The student gets a personal plan copied from the program; Murad edits it | Claude Code | 010, 012 |
| 013 | Student sees «Сегодня», the week grid and all weeks | Codex | 012, 018 |
| 014 | Slot timer with a sound at the minimum | Claude Code | 013 |
| 015 | Mark a slot manually, including past days | Claude Code | 014 |
| 016 | Student comments on a day; Murad reads comments | Claude Code | 013 |
| 017 | Pause and resume, no limits | Claude Code | 013, 014 |

Order of work: 011 → 009 → 010 → 012 → 018 → 013 → 014 → 015 → 016 → 017. Data stories go strictly one after another (each adds a migration); 013 is UI only and can be started as soon as 018 is merged.

## Decisions this epic changes

`docs/product.md` says «не делаем аккаунты учеников, оплату, комментарии». D-SP-1 (accepted Oct 8, 2026) brings in invite-only student accounts and private day comments; update `product.md` in the first PR of the epic. Payment stays out. All decisions: `study-programs-decisions.md` (D-SP-1…9).

## Analytics events (no personal data)

- `program_assigned` {programSlug, levelFrom, levelTo, placementTest, placementCefr}
- `program_started` {programSlug, levelFrom, levelTo, daysFromAssignToStart}
- `slot_completed` {slotTypeId, minutesBucket: "<15" / "15–30" / "30–60" / "60+", viaTimer: bool}
- `program_paused` / `program_resumed` {programSlug}

Never include email, name, exact test score, placement note, comment or task text, or user id.

## Out of scope for this epic

Payment, trial, freemium; self-learners and public sign-up; public program catalog; placement test on the site and automatic score → CEFR conversion; program builder for students; AI roadmap; reminders and notifications; Murad replying to comments on the site; task submissions and grading; listening tools.

## Answered (Oct 8, 2026)

| # | Question | Answer |
| --- | --- | --- |
| — | Student accounts? | Yes (D-SP-1) |
| Q1 | Template days: relative to start or calendar weekdays? | Relative to start (D-SP-3) |
| Q2 | Who picks the program? | Murad assigns after a placement test (D-SP-6) |
| Q3 | Tasks common or individual? | Individual per student, built from a shared pool by level (D-SP-5) |
| Q4 | Is a slot done only at the minimum? | Yes (D-SP-7) |
| Q5 | Manual marking of past days? | Yes |
| Q6 | Pause limits? | None |
| Q7 | Future weeks visible? | Yes, slots and tasks |
| Q8 | «Ты» or «вы»? | Student's setting, default «ты» (D-SP-8) |
| Q10 | Placement result format? | Common test scales (IELTS, TOEFL, Cambridge…) + CEFR (D-SP-9) |
| Q14 | D-SP-2 limits (code 10 min, session 30 days) and D-SP-4 (timer stops at 4 h)? | Accepted (D-SP-2, D-SP-4) |

## Open questions (assumptions in force until answered)

| # | Question | Assumption |
| --- | --- | --- |
| Q9 | After finishing, who starts the next level? | Murad assigns the next program |
| Q11 | Which test does Murad actually use, and which of the listed ones are needed at launch? | All listed; unused ones are harmless |
| Q12 | Default form for new students — «ты» or «вы»? | «Ты»; Murad can preset per student |
| Q13 | Up to 3 tasks per day — enough? | Yes |
