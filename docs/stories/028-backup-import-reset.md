---
id: 028
title: Planner backup, import of the old mock and reset
status: approved
---

# 028 — Backup, import, reset

**As the** owner **I want** to export, import and reset a student's planner **so that** I keep copies and move Murad's existing mock data into the portal.

## Acceptance criteria

1. `[happy]` **Given** «Export backup» **then** a JSON file downloads: `schemaVersion`, `exportedAt`, planner fields, all weeks / rows / cells / notes, appearance, deadline, toggles, and the background image inline (data URI).
2. `[happy]` **Given** an exported file **when** the planner is reset and the file imported **then** everything is restored identical (round-trip test).
3. `[happy]` **Given** the mock's `localStorage` state (`sergei-week-planner-v2`, `{baseDate, weeks[{priorities, cells, notes}], global, colors, colorOpacity, background, progress, typography}`) **when** its JSON is imported **then** it is migrated into the new model; priority labels are regenerated as Roman numerals; unknown fields are dropped.
4. `[edge]` **Given** malformed JSON, wrong types, invalid dates, a too-big image **then** a code error; nothing is written (one transaction).
5. `[edge]` **Given** a populated planner **when** importing **then** an explicit confirmation is required; cancel keeps data.
6. `[happy]` **Given** «Reset entire planner» + a serious confirmation **then** it returns to the blank state of 022 (no name, goal, one week, one row, default appearance); no demo data comes back.
7. `[access]` **Given** a student **then** she can export her own planner; import and reset are owner-only (403).
8. `[edge]` **Given** a backup with a newer `schemaVersion` **then** refused with `unsupportedVersion`.

## Out of scope

Versions 5–8 of other mock files that were never shared; only the shape above is migrated (more fixtures if Murad sends them).

## Verification

| # | Test | Layer |
| --- | --- | --- |
| 1,3,4,8 | `planner-backup.unit.spec.ts` (fixture = state taken from the mock) | unit |
| 2,5,6,7 | `planner-backup.int.spec.ts` | int |
| 1,2 | `planner.e2e.spec.ts` › export → reset → import | e2e |
