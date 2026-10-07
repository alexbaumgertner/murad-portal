#!/usr/bin/env bash
# Idempotent setup for cloud agents (Codex cloud, Claude Code on the web, Cursor),
# dev containers and fresh Linux machines: Postgres with dev + test databases,
# dependencies, a .env and Playwright's Chromium. Safe to re-run any time
# (e.g. when an agent finds Postgres stopped).
set -euo pipefail

cd "$(dirname "$0")/.."

# Root in Codex cloud, a sudo user elsewhere.
SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

pg_up() { (exec 3<>/dev/tcp/127.0.0.1/5432) 2>/dev/null; }

if pg_up && ! command -v pg_ctlcluster >/dev/null 2>&1; then
  # Postgres is provided from outside (dev container `db` service, docker compose):
  # its init script already created `app` and `app_test`.
  echo "cloud-setup: using existing Postgres on 127.0.0.1:5432"
else
  if ! command -v psql >/dev/null 2>&1; then
    $SUDO apt-get update -qq
    $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql
  fi
  $SUDO service postgresql start

  as_pg() { if [ -n "$SUDO" ]; then sudo -u postgres "$@"; elif [ "$(id -u)" -eq 0 ]; then su postgres -c "$(printf '%q ' "$@")"; else "$@"; fi; }

  as_pg psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='app'" | grep -q 1 ||
    as_pg psql -qc "CREATE USER app WITH PASSWORD 'app' CREATEDB;"
  for db in app app_test; do
    as_pg psql -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 ||
      as_pg psql -qc "CREATE DATABASE $db OWNER app;"
  done
fi

corepack enable >/dev/null 2>&1 || $SUDO corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s/^PAYLOAD_SECRET=.*/PAYLOAD_SECRET=$(openssl rand -hex 32)/" .env
fi

if [ -n "$SUDO" ] || [ "$(id -u)" -eq 0 ]; then
  pnpm exec playwright install --with-deps chromium >/dev/null
else
  pnpm exec playwright install chromium >/dev/null
fi
