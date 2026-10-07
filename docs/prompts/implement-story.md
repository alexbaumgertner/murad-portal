# Implement a story

Codex cloud: environment `murad-portal`, branch name from AGENTS.md. Claude Code: run `/feature` and point it at the story instead.

```markdown
Implement docs/stories/<NNN-slug>.md (status must be `approved`; if it is not, stop and say so).

Follow AGENTS.md and the nested AGENTS.md for every folder you touch. Payload API reference:
.claude/skills/payload/SKILL.md (+ reference/*.md as needed).

Order: failing tests per acceptance criterion → collection → `pnpm generate:types` → service → action → UI.
If the story changes collections, run `pnpm migrate:create <slug>` and commit the migration.
If Postgres is not running, run `bash scripts/cloud-setup.sh`.

Done when `pnpm check`, `pnpm test:int` and `pnpm test:e2e` pass, the story's Verification table is filled and
its status is `done`. Open a PR on branch `<agent>/<NNN-slug>` using .github/pull_request_template.md.
Do not change anything outside the story's scope; list follow-ups in the PR instead.
```
