#!/usr/bin/env bash
# Bash fallback: requires `psql` installed locally.
# Usage: ./scripts/db-push.sh [migrations|schema|all]

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-migrations}"

if [ -f "$ROOT/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -v '^#' "$ROOT/.env.local" | sed 's/\r$//')
  set +a
fi

if [ -n "${DATABASE_URL:-}" ]; then
  CONN="$DATABASE_URL"
elif [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ] && [ -n "${SUPABASE_DB_PASSWORD:-}" ]; then
  REF="${SUPABASE_PROJECT_REF:-$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's|https?://([^.]+).*|\1|')}"
  HOST="${SUPABASE_DB_HOST:-db.${REF}.supabase.co}"
  CONN="postgresql://postgres:${SUPABASE_DB_PASSWORD}@${HOST}:5432/postgres"
else
  echo "Missing DATABASE_URL or SUPABASE_DB_PASSWORD in .env.local"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Use: npm run db:push"
  exit 1
fi

run_file() {
  echo "▶ Applying: $(basename "$1")"
  psql "$CONN" -v ON_ERROR_STOP=1 -f "$1"
  echo "✓ Success: $(basename "$1")"
}

case "$MODE" in
  schema)
    run_file "$ROOT/supabase/schema.sql"
    ;;
  all)
    run_file "$ROOT/supabase/schema.sql"
    for f in "$ROOT"/supabase/migrations/*.sql; do
      [ -f "$f" ] && run_file "$f"
    done
    ;;
  *)
    for f in "$ROOT"/supabase/migrations/*.sql; do
      [ -f "$f" ] && run_file "$f"
    done
    ;;
esac

psql "$CONN" -c "NOTIFY pgrst, 'reload schema';" || true
echo "Done."
