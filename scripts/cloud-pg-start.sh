#!/usr/bin/env bash
# Fast, idempotent: make sure Postgres is running with the `app` role and the
# `app` + `app_test` databases. Used by the Claude Code SessionStart hook
# (.claude/settings.json) and by cloud-setup.sh. No dependency install.
set -euo pipefail

cd "$(dirname "$0")/.."

# Root in Codex cloud, a sudo user elsewhere.
SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

pg_up() { (exec 3<>/dev/tcp/127.0.0.1/5432) 2>/dev/null; }

if pg_up && ! command -v pg_ctlcluster >/dev/null 2>&1; then
  # Postgres is provided from outside (dev container `db` service, docker compose):
  # its init script already created `app` and `app_test`.
  echo "cloud-pg-start: using existing Postgres on 127.0.0.1:5432"
  exit 0
fi

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
echo "cloud-pg-start: Postgres is up"
