# Product

Agents read this before building user-facing features. Keep it under one page.

## One-liner

A site for Murad, an English teacher, where learners train the step from "I understand the meaning"
to "I actually hear and recognize familiar words in live speech" — and where Murad publicly tracks his own
90-day YouTube challenge.

## Roles

- **Learner** — Russian-speaking, learns English (often for IELTS / TOEFL / Cambridge), comes from Murad's YouTube
  channel. Anonymous by default; uses the site on a phone.
- **Murad (owner)** — signs in to `/admin` with the email code. Writes content, logs his challenge days.
- **Student** — Murad's student; accounts are invite-only (аккаунты учеников — только по приглашению, D-SP-1):
  Murad invites her from `/admin`, she signs in on `/login` with an email code and studies on `/study`. No admin access.
- **Visitor** — anyone watching the public challenge page, often from a link in a video or post.

## Core jobs to be done

1. **Challenge Tracker (Epic 1, first).** Murad runs "90 days / 90 minutes / 1 project": the first 90 minutes of
   every workday go to his YouTube channel. 90 days = 6 videos × 15-day blocks. He closes each day with minutes and
   2–3 short notes, writes a 3-sentence retro after each published video (what worked · where viewers dropped ·
   what changes next time), and sees progress: minutes out of 8 100 (135 h), videos out of 6, sessions completed
   out of planned, countdown to the end. The page is public — accountability is part of the method.
2. **Listening tools (Epic 2+, after a research spike):**
   - _Phonetic Puzzle_ — 10–20 real pronunciations of one word (different speakers, accents, speed, emotion), then
     guess the word in fast or distorted speech.
   - _3-Step Listening Player_ — video + subtitles → word & grammar breakdown → audio playlist for background
     re-listening, with listen counts and repetition reminders.
   - _Level & Interest Matcher_ — content picked by level + interests, split into scripted speech and live speech
     (podcasts, interviews, streams).
   - _Active Listening Quizzer_ — from any video, AI generates multiple choice, fill-in-the-blanks and dictation;
     e.g. hide familiar words in the subtitles and check whether the learner hears them.

## What we deliberately don't do (for now)

- Public sign-up or self-learner accounts (student accounts are invite-only), payments, a public course catalog,
  public comments (student day comments are private: student + owner, D-SP-1).
- A general-purpose habit tracker: the tracker is built for one challenge format (90 × 90 × N videos).
- Hosting video: we embed YouTube.

## Voice & copy

- Russian first (audience), English second. Address the reader as «ты»? — **open question for Murad**.
- Plain, warm, encouraging, no hype. Short sentences. Teacher talking to a student, not a startup landing page.

## Open questions

- Default locale: Russian unprefixed (`/`) and English under `/en`? (proposed, see `docs/decisions.md`)
- Are day notes public, or only the fact that a day is closed?
- Murad's time zone for "today" (Astana, `Asia/Almaty`, UTC+5) — confirm.
- Brand: site name, domain, colors (reference landing: `docs/reference/landing.html`).

## Customer quotes / interview notes

- 2026-10-06, Murad (voice note, paraphrased): "an online tracker with a countdown, where I write what I did each
  day — a table of 90 squares, every 15 squares a new video, you close a square and write three sentences, and
  progress bars show the time spent: +90 minutes, out of 8 100 total, 135 hours."
