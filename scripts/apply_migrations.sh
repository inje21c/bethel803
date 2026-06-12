#!/usr/bin/env bash
# supabase/migrations/*.sql 중 미적용 파일만 순서대로 적용한다.
# 적용 이력은 public._migrations 테이블로 추적한다.
#
# 사용: DB_URL="postgresql://..." bash scripts/apply_migrations.sh
#
# 최초 실행(이력 테이블이 비어 있음) 시에는 실행 없이 전체 파일을
# "적용됨"으로 기준선(baseline) 처리한다 — 수동으로 적용해온 기존 DB를
# 그대로 기준점으로 삼기 위함이다.

set -euo pipefail

: "${DB_URL:?DB_URL env var is required (postgres connection string)}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PSQL=(psql "$DB_URL" -v ON_ERROR_STOP=1 -qAt)

"${PSQL[@]}" -c "
CREATE TABLE IF NOT EXISTS public._migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  baseline   BOOLEAN NOT NULL DEFAULT false
);" > /dev/null

count="$("${PSQL[@]}" -c "SELECT count(*) FROM public._migrations;")"

if [ "$count" = "0" ]; then
  echo "[baseline] _migrations is empty — marking all existing files as applied (no execution)"
  for f in supabase/migrations/*.sql; do
    name="$(basename "$f")"
    "${PSQL[@]}" -c "INSERT INTO public._migrations (filename, baseline) VALUES ('$name', true) ON CONFLICT DO NOTHING;" > /dev/null
    echo "[baseline] $name"
  done
  echo "[baseline] done. Future runs will apply only new files."
  exit 0
fi

applied_any=0
for f in $(ls supabase/migrations/*.sql | sort); do
  name="$(basename "$f")"
  exists="$("${PSQL[@]}" -c "SELECT 1 FROM public._migrations WHERE filename = '$name';")"
  if [ -z "$exists" ]; then
    echo "[apply] $name"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
    "${PSQL[@]}" -c "INSERT INTO public._migrations (filename) VALUES ('$name');" > /dev/null
    applied_any=1
  fi
done

if [ "$applied_any" = "0" ]; then
  echo "[ok] no new migrations"
fi
