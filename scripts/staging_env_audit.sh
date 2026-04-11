#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f ".env.local" ]; then
  echo "[fail] .env.local is missing"
  exit 1
fi

supabase_url="$(grep '^VITE_SUPABASE_URL=' .env.local | cut -d= -f2-)"
app_url="$(grep '^VITE_APP_URL=' .env.local | cut -d= -f2-)"
current_prod_supabase_url=""
current_prod_app_url=""

if [ -f ".github/workflows/deploy.yml" ]; then
  current_prod_supabase_url="$(grep 'VITE_SUPABASE_URL:' .github/workflows/deploy.yml | head -n 1 | sed 's/.*VITE_SUPABASE_URL:[[:space:]]*//')"
  current_prod_app_url="$(grep 'VITE_APP_URL:' .github/workflows/deploy.yml | head -n 1 | sed 's/.*VITE_APP_URL:[[:space:]]*//')"
fi

echo "== bethel803 staging env audit =="

if [ -z "$supabase_url" ]; then
  echo "[fail] VITE_SUPABASE_URL is missing in .env.local"
  exit 1
fi

if [ -z "$app_url" ]; then
  echo "[fail] VITE_APP_URL is missing in .env.local"
  exit 1
fi

echo "[info] VITE_SUPABASE_URL=$supabase_url"
echo "[info] VITE_APP_URL=$app_url"

if ! printf '%s' "$app_url" | grep -Eq '^https?://'; then
  echo "[warn] VITE_APP_URL should include http:// or https://"
elif printf '%s' "$app_url" | grep -Eq '^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?/?$'; then
  echo "[ok] VITE_APP_URL is a local development URL"
elif [ -n "$current_prod_app_url" ] && [ "$app_url" = "$current_prod_app_url" ]; then
  echo "[warn] .env.local currently matches the current production app URL"
elif printf '%s' "$app_url" | grep -Eq 'vercel\.app'; then
  echo "[ok] VITE_APP_URL looks like a Vercel preview or staging URL"
else
  echo "[warn] VITE_APP_URL should be reviewed against the intended local or preview URL"
fi

if [ -n "$current_prod_supabase_url" ] && [ "$supabase_url" = "$current_prod_supabase_url" ]; then
  echo "[warn] VITE_SUPABASE_URL currently matches the production Supabase URL"
elif printf '%s' "$supabase_url" | grep -Eq '^https://[a-z0-9-]+\.supabase\.co$'; then
  echo "[ok] VITE_SUPABASE_URL is a valid Supabase project URL and does not match current production"
else
  echo "[warn] VITE_SUPABASE_URL does not look like a valid Supabase project URL"
fi

echo
echo "next:"
echo "1. Keep .env.local on staging values, not production values."
echo "2. Prefer http://localhost:8080 for local dev, and use Vercel preview URLs in Vercel env only."
echo "3. Re-run: npm run staging:env-check"
