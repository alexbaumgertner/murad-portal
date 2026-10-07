# murad-portal — bootstrap

Два слоя файлов, которые копируются поверх репозиториев:

- `1-template-upgrade/` — общие улучшения для `payload-vercel-template`: dev container (Zed / Codespaces),
  `cloud-setup.sh` для Codex cloud и Claude Code on the web, SessionStart-хук, раздел про multi-agent workflow
  в `AGENTS.md`, PR-шаблон, промпты в `docs/prompts/`. Пригодятся всем будущим продуктам.
- `2-murad-portal/` — всё специфичное для Мурада: `product.md`, stories 004–008 (эпик «Трекер»),
  спайк по аудио/субтитрам, решение о русском по умолчанию.

Файлы только добавляются или заменяются, ничего не удаляется.

## 1. Обновить шаблон и сделать его Template repository

```bash
cd payload-vercel-template
git switch -c chore/multi-agent-workflow
cp -R ../murad-portal-bootstrap/1-template-upgrade/. .
git add -A && git commit -m "chore: dev container, cloud setup for Codex/Claude web, multi-agent workflow"
git push -u origin HEAD   # PR → CI зелёный → merge
```

Затем на GitHub: **Settings → General → Template repository** (галочка).

## 2. Создать murad-portal из шаблона

```bash
gh repo create murad-portal --template alexbaumgertner/payload-vercel-template --private --clone
cd murad-portal
cp -R ../murad-portal-bootstrap/2-murad-portal/. .
sed -i '' 's/"name": "payload-vercel-template"/"name": "murad-portal"/' package.json   # macOS sed
git add -A && git commit -m "docs: murad-portal product, tracker epic stories" && git push
```

Чтобы позже подтянуть улучшения шаблона:

```bash
git remote add template https://github.com/alexbaumgertner/payload-vercel-template
git fetch template
git cherry-pick <sha>          # история не связана, поэтому cherry-pick, а не merge
```

## 3. Vercel + Neon

1. Vercel → **Add New → Project** → импорт `murad-portal`. Build command берётся из `vercel.json`.
2. **Storage → Create Database → Neon** (Marketplace) → подключить к проекту. Включить создание ветки базы
   на каждый Preview deployment.
3. Env vars: `PAYLOAD_SECRET` (`openssl rand -hex 32`), `NEXT_PUBLIC_SITE_URL`; позже `RESEND_API_KEY`,
   `EMAIL_FROM_ADDRESS`, `BLOB_READ_WRITE_TOKEN`.
4. После первого деплоя: `pnpm create-admin <email Мурада>` против prod-базы (вручную, не агентом —
   см. `docs/runbooks`).

## 4. Codex cloud

chatgpt.com/codex → **Settings → Environments → Create environment** → репозиторий `murad-portal`:

- Setup script: `bash scripts/cloud-setup.sh`
- Agent internet access: **Off** (зависимости ставятся в setup).
- Секреты не нужны: `.env` создаётся скриптом, база локальная.

В настройках Codex включи **Code review** для репозитория, тогда `@codex review` в PR запускает ревью.

## 5. Claude Code on the web

claude.ai/code → подключить репозиторий. Окружение поднимает хук `SessionStart` из `.claude/settings.json`
(срабатывает только при `CLAUDE_CODE_REMOTE=true`). Если `apt-get install postgresql` упрётся в сетевую
политику, переключи network access окружения на режим, где разрешён `archive.ubuntu.com`.

## 6. Локально: Zed + dev container

1. Docker на Mac: OrbStack (легче Docker Desktop на M-серии).
2. Zed → открыть `murad-portal` → в command palette найти действие для dev containers и открыть проект в контейнере.
   Запасной путь, если поддержка в твоей версии Zed капризничает:
   `npx @devcontainers/cli up --workspace-folder .`, затем работа в терминале контейнера.
3. Внутри: `pnpm dev`, `claude` и `codex` (логин один раз, сохраняется в volume между проектами).
4. Тот же `.devcontainer` открывается в GitHub Codespaces, если ноутбука нет под рукой.

## 7. Первый цикл

1. Сохрани исходный лендинг в `docs/reference/landing.html`.
2. Решение о локали в `docs/decisions.md`: подтверди или отклони.
3. **Claude Code (Opus, plan mode)**: промпт `docs/prompts/plan-epic.md`, эпик «Challenge Tracker».
   Claude сверит черновики 004–008 с кодом и поправит их. Ты апрувишь (`status: approved`).
4. Порядок: **005** (модель, миграция) → **006** и **004** параллельно → **007** → **008**.
   005 лучше сделать в Claude Code (`/feature`, Sonnet): Payload-skill и хуки. Остальное отдавай в Codex cloud
   с промптом `docs/prompts/implement-story.md`.
5. Ревью: `@codex review` на каждый PR; для 005 и 007 (доступы, auth) дополнительно `docs/prompts/review-pr.md`
   в Claude Code.
6. Merge → прод. Мурад закрывает дни, которые успел пройти (бэкфилл предусмотрен в 007).

Параллельно отправь в Gemini Deep Research `docs/prompts/research-spike.md` со спайком 001. От его итогов зависит,
какие из четырёх инструментов реалистичны.

## Экономия лимитов

- В Claude Code: Opus только для планирования, `/model sonnet` для кода, `/clear` между stories.
- В `.mcp.json` пять серверов. Для повседневной работы хватит `context7` и `chrome-devtools`,
  `playwright` дублирует последний. Неиспользуемые можно отключить через `/mcp`.
- Не держи в одной сессии больше одной story.
