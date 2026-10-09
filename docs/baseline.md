# Baseline

What every product built from this template gets out of the box. Update this table in every PR that changes one of these areas.

| Area               | Status  | Note                                                                                                                                                                                                                                      |
| ------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public tracker     | done    | Localized `/challenge/[slug]`, anonymous access checks, 90-day grid, progress and countdown; idempotent demo seed; 360px verified; signed-in admin closes days (007) and saves video publications and public retros (008)                 |
| Auth               | done    | Passwordless email codes; hashed codes, DB rate limits, signed cookie. Owner → `/admin` (7-day session); invited students → `/login` → `/study` (30 days), `/admin` redirects them to `/study`                                            |
| i18n               | done    | next-intl: `ru` (unprefixed) + `/en`; students pick «ты»/«вы» (`messages/ru-vy.json`, student namespaces only); browser language ignored, cookie remembered; Russian `x-default`; hreflang, `<html lang>`, switcher; English CMS fallback |
| Security headers   | partial | HSTS, nosniff, Referrer/Permissions-Policy, frame-ancestors enforced; CSP report-only, no violations in a prod build                                                                                                                      |
| Backups            | partial | Neon instant restore + drill in `docs/runbooks/backup-restore.md`; Vercel Blob media have no backup (documented)                                                                                                                          |
| Monitoring         | done    | Sentry (server, client, Server Actions) when `SENTRY_DSN` is set; PII scrubbed; no-op otherwise                                                                                                                                           |
| Analytics          | done    | Typed `track()` catalog, no-op by default; Vercel adapter via `ANALYTICS_PROVIDER`; DNT/GPC respected, no PII                                                                                                                             |
| CI                 | done    | GitHub Actions: check, int (Postgres 18), browser, e2e; no secrets; artifacts on failure                                                                                                                                                  |
| Dependency updates | done    | Dependabot weekly; Payload / React / Next / dev-tools grouped; majors as separate PRs                                                                                                                                                     |

Features are specified in `docs/stories/` — each acceptance criterion maps to a named test.
Agent safety: shell + MCP guards with tests; known gaps (cloud agents skip MCP hooks) in `docs/decisions.md`.
