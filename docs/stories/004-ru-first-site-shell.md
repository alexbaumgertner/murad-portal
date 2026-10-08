---
id: 004
title: Visitors land on Murad's site in Russian
status: done
---

# 004 — Russian-first site shell for Murad

**As a** learner coming from Murad's YouTube channel
**I want** the site to open in Russian with Murad's name and a clear way to the challenge and the tools
**so that** I immediately understand whose site this is and where to go.

## Acceptance criteria

1. `[happy]` **Given** a visitor without a `NEXT_LOCALE` cookie and any `Accept-Language` **when** they open `/` **then** the page is in Russian (`<html lang="ru">`), unprefixed.
2. `[happy]` **Given** a visitor **when** they open `/en` **then** they see the English version; the switcher moves between `/` and `/en` keeping the path.
3. `[happy]` **Given** the landing page **when** it renders **then** it shows the site name from `siteConfig`, a hero about Murad, a link to the challenge page and a "Tools — coming soon" section listing the four tools from `docs/product.md`.
4. `[edge]` **Given** the template's waitlist **when** the landing renders **then** the waitlist form is not shown (the collection and code stay; removal is out of scope).
5. `[edge]` **Given** any page **when** rendered **then** canonical and hreflang alternates are correct for the new default and `x-default` points to Russian.
6. `[edge]` **Given** a 360px viewport **when** the landing renders **then** nothing overflows horizontally.

## Out of scope

- Final visual design from `docs/reference/landing.html` (separate story once the reference is in the repo).
- Removing the waitlist and changelog code.
- Building the challenge tracker (story 006). The shell links to `/challenge`; it remains a 404 until the tracker route is implemented, with the final challenge slug wired then.

## Notes

- Touches `src/i18n/locales.ts`, `src/config/site.ts`, `messages/*.json`, landing page, i18n e2e tests that assume English default.
- Update `docs/decisions.md` (mark the locale decision accepted) and `docs/baseline.md` (i18n row).

## Verification

| #   | Test (file › name)                                                                                                                                 | Layer      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | `i18n.e2e.spec.ts` › a {ru-RU,en-US,de-DE} browser without a locale cookie lands in Russian at /                                                   | e2e        |
| 2   | `i18n.e2e.spec.ts` › switches {/,/changelog} in both directions and remembers the choice                                                           | e2e        |
| 3   | `landing.e2e.spec.ts` › {/,/en} shows Murad, the challenge and four upcoming tools                                                                 | e2e        |
| 4   | `landing.e2e.spec.ts` › {/,/en} hides the waitlist form                                                                                            | e2e        |
| 5   | `i18n.unit.spec.ts` › localized paths; `i18n.e2e.spec.ts` › {/,/en,/changelog,/en/changelog} has canonical and Russian-default hreflang alternates | unit + e2e |
| 6   | `landing.e2e.spec.ts` › {/,/en} fits a 360px viewport                                                                                              | e2e        |

Verification completed: `pnpm check` (180 unit tests), `pnpm test:int` (41 tests), and the full desktop/mobile e2e suite (69 passed initially; all 11 failed/skipped checks passed on rerun after fixes). Desktop and 360px browser inspection: no horizontal overflow or console errors. Reviewer: no P0/P1 findings.
