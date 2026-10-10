---
id: 020
title: Visitors see the list of public challenges
status: approved
---

# 020 — Challenge list on `/challenge`

**As a** visitor
**I want** `/challenge` to show the public challenges
**so that** the "Challenge" link in the header leads somewhere instead of a 404.

## Acceptance criteria

1. `[happy]` **Given** several public challenges **when** I open `/challenge` **then** I see one card per challenge, newest start date first: title, start date, status (not started / running / finished), «День X из N» and minutes done; the card links to `/challenge/<slug>`.
2. `[edge]` **Given** exactly one public challenge **when** I open `/challenge` **then** I am redirected to it.
3. `[edge]` **Given** no public challenges **when** I open `/challenge` **then** a plain «Челлендж скоро появится» message is shown, not a 404.
4. `[access]` **Given** a non-public challenge **when** an anonymous visitor opens `/challenge` **then** it is not listed (reads use `overrideAccess: false`).
5. `[ui]` **Given** ru and en and a 360 px screen **then** all texts exist in both locales and nothing scrolls horizontally.

## Out of scope

- Revalidation hooks: the list is rendered per request (`force-dynamic`), like the tracker page.
- Pagination, search, challenge covers.

## Verification

| #   | Test (file › name)                                                    | Layer |
| --- | --------------------------------------------------------------------- | ----- |
| 1   | `tests/e2e/challenge-list.e2e.spec.ts` › cards for public challenges  | e2e   |
| 1   | `tests/int/challenge-list.int.spec.ts` › newest first, with summary   | int   |
| 2–3 | `tests/unit/challenge-list.unit.spec.ts` › redirect / empty / list    | unit  |
| 4   | `tests/int/challenge-list.int.spec.ts` › anonymous read hides private | int   |
| 5   | `tests/e2e/challenge-list.e2e.spec.ts` › 360px and both locales       | e2e   |
