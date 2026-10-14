# Epic: Weekly Planner («Недельный планер ученика»)

Status: approved · Oct 14, 2026 · source: Murad's ChatGPT mock `docs/references/14102026/learning-week-planner.html` + his master prompt (pasted in chat), answers of the owner: **live in the portal on the DB; take everything from the prompt**.

## Goal

Murad plans a student's week as a spreadsheet: weekday columns × priority rows (I, II, III …), a task in each cell, the student ticks done, a mini-diary (Exercises / Questions) under the grid, and optional progress bars (week · 4 weeks · exam deadline). Today this lives in a standalone HTML on `localStorage`; it moves into the portal so data survives devices, the student opens it by her own login, and Murad edits it from anywhere.

## Reference (the mock)

- State: `baseDate` (Monday of week 1), `weeks[]` {`priorities[]`, `cells[row][day]` {text, done}, `notes` {exercises[7], questions[7]}}, `global` labels (student, goal, subtitle, headings), `colors` + `colorOpacity`, `background`, `progress`, `typography`.
- Empty-task policy: blank, whitespace, `-`, `—`, `–` do not count and cannot be ticked (clearing text clears the tick).
- Every new week starts with exactly one empty priority row.

## Differences from the mock that need an owner decision (see «Open questions»)

| Mock | Portal |
| --- | --- |
| One anonymous user, `localStorage` | One planner per student, Payload collections, access by role |
| UI 100% English | Portal rule: every key in `messages/en.json` **and** `ru.json`. English stays the default copy for the planner; Russian is added |
| Background image as base64 in the page | Image goes to Media (Vercel Blob in prod); backup JSON embeds it |
| Standalone, opens from a file | Portal page `/study/planner` (student) and an owner view; no standalone file |

## Roles

| Role | Can do |
| --- | --- |
| Owner (Murad) | Creates a planner for a student; edits everything: labels, weeks, rows, tasks, diary, deadline, appearance |
| Student | Reads her planner; ticks / unticks done; writes her own diary text (proposed, Q-WP-1); changes **her own** appearance (proposed, Q-WP-2) |
| Visitor | Nothing; planners are private (not even a public read) |

## Data model (overview)

| Collection | Main fields | Write | Read |
| --- | --- | --- | --- |
| `planners` | `student` (unique rel → users), `baseDate` (Monday, `YYYY-MM-DD`), `studentName`, `goal`, `subtitle`, `labels` (schedule, goal, exercises, questions, 7 weekday names, 7 diary day names), `deadline` {enabled, title, date}, `progress` {showWeek, showFourWeeks, showDeadline}, `appearance` (JSON validated by Zod, versioned: colors+alpha, typography, background, bars) | owner; student — `appearance` only | owner; student — own |
| `planner-weeks` | `planner`, `index` (0-based, unique per planner), `rowCount` ≥1 ≤40, `notes` (14 × {kind exercises/questions, day 0–6, text ≤2000}) | owner; student — `notes` | owner; student — own |
| `planner-cells` | `week`, `row`, `day` 0–6, `text` ≤500, `done`; unique (week,row,day) | owner — text; student — `done` only | owner; student — own |

Dates are strings; week N Monday = `baseDate + 7N` computed on UTC-noon calendar days (no timestamp drift across DST / leap years). Row label = Roman numeral of `row+1`, generated, never stored.

## Stories (one PR each; collection stories run sequentially)

| # | Story | Layer | Migration |
| --- | --- | --- | --- |
| 022 | Planner core: grid, rows, cells, ticks, week navigation | collections + UI | yes |
| 023 | Header, labels, mini-diary, print | UI | no (uses 022 fields) |
| 024 | Progress: week · 4-week weighted · deadline | pure functions + UI | no |
| 025 | Colors with alpha, typography (30 fonts), reset | appearance JSON + UI | no |
| 026 | Background image, blur / brightness / overlay / grain | Media + UI | maybe |
| 027 | Ambient progress bars: 11 animations, per-bar settings | CSS + UI | no |
| 028 | Backup JSON export / import / reset + import of the mock's `localStorage` state | actions | no |

Order: 022 → 024 → 023 → 025 → 026 → 027 → 028 (024 early: its pure functions are tested first and used by 023/027).

## Decisions (owner, Oct 14, 2026)

- Q-WP-1 student writes the diary **and** changes appearance (Q-WP-2). Q-WP-3 separate from programs. Q-WP-4 English default + Russian translation of every key. Q-WP-5 spike first (in 025). Q-WP-7 deleting a week **leaves a gap**: other weeks keep their index and dates.

## Open questions (answered above, kept for history)

- **Q-WP-1** May the student write diary text, or only tick? Proposed: both.
- **Q-WP-2** Does the student change appearance (fonts, colors, background) or only Murad? Proposed: the student, for her own view; Murad's choice is the default.
- **Q-WP-3** Relation to the existing program plan (`student-assignments`, ≤3 tasks a day, slot timers): proposed — separate; the planner is free-form homework, programs stay. Should `/study` link both?
- **Q-WP-4** Language: English UI by default as in the prompt, plus a Russian translation of every key (portal rule)? Or English-only for this page (needs a decision in `docs/decisions.md`)?
- **Q-WP-5** Fonts: 30 families with Latin + Cyrillic. Load via `next/font/google` (self-hosted at build) — adds weight to this page only. OK? Proposed: load a family only when chosen.
- **Q-WP-6** Tick on an empty cell: refuse (as in the mock). Confirm.
