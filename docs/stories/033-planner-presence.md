---
id: 033
title: Murad and the student see that the other person is in the planner right now
status: draft
---

# 033 — Planner presence

**As** Murad (owner) or a student
**I want** to see whether the other person has the planner open right now
**so that** I know my changes are being seen, as in a shared Google Sheet.

Epic: `weekly-planner-epic.md`. Follows story 032 (live sync by polling). Spike: `docs/spikes/002-planner-realtime-sync.md`.
Only on `/study/planner`. Owner asked for it "if it is not too hard" on Oct 16, 2026; polling cannot show presence, so
this needs a managed pub/sub service (Pusher or Ably). **Draft: pick the vendor and check its free-tier limits and
terms first, then ask the owner to approve.** Estimate: ~1.5–2 days.

## Notes for the plan (to be settled before approval)

- One private presence channel per planner; the server authorizes a subscription only for the planner's student and the
  owner (reuse the session check of `currentUser`). Events carry no planner data, only "who is here".
- Optional bonus: a "planner changed" signal on the same channel could trigger the refresh of story 032 at once; the
  poll then slows to a fallback. Decide in this story, not in 032.
- A new vendor means: keys in `src/lib/env.ts` and `.env.example` (optional, the feature is a no-op when unset, like
  Resend and Sentry), the vendor's origins in `connect-src` of `src/lib/security-headers.ts`, and a Vercel env change
  (human). No new library without the owner's approval.
- Vercel Hobby: the vendor connection is opened by the browser, so it does not use function time; the auth endpoint is a
  short request.

## Acceptance criteria

1. `[happy]` **Given** the student has the planner open **when** the owner opens the same planner **then** each side sees
   an "online" mark for the other within a few seconds, and it disappears within ~30 s after the other closes the tab.
2. `[access]` **Given** another student, an anonymous caller or a foreign planner id **when** a subscription is requested
   **then** it is refused and nothing about the planner is exposed.
3. `[edge]` **Given** no vendor keys (local dev, e2e) **then** the planner works as in 032 and shows no presence mark
   and no error.
4. `[edge]` **Given** the vendor is unreachable **then** the planner keeps working, the mark is hidden, and there is no
   console error that fails the e2e CSP check.
5. `[happy]` **Given** the `en` and `ru` locales **then** the mark has an accessible name in both; works at 360 px.
6. `[edge]` **Given** the same person with two tabs **then** they count as one person.

## Out of scope

- Typing indicators, cursors, "who edits this cell".
- Presence outside `/study/planner`.
- Showing presence in the owner's dashboard `/study/students`.

## Verification

| #   | Test (file › name)                                            | Layer                         |
| --- | ------------------------------------------------------------- | ----------------------------- |
| 1   | `tests/e2e/planner-presence.e2e.spec.ts` › two contexts       | e2e (vendor stubbed)          |
| 2   | `tests/int/planner-presence.int.spec.ts` › access             | int                           |
| 3–4 | `tests/browser/PlannerPresence.browser.spec.tsx`              | browser                       |
| 5   | manual: 360 px, both locales                                  | browser (Chrome DevTools MCP) |
| 6   | `tests/browser/PlannerPresence.browser.spec.tsx` › one person | browser                       |
