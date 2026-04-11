#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

status=0

ok() {
  printf '[ok] %s\n' "$1"
}

warn() {
  printf '[warn] %s\n' "$1"
}

fail() {
  printf '[fail] %s\n' "$1"
  status=1
}

run_with_timeout() {
  local seconds="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$seconds" "$@"
  else
    "$@"
  fi
}

contains_text() {
  local pattern="$1"
  local path="$2"
  if command -v rg >/dev/null 2>&1; then
    rg -q "$pattern" "$path"
  else
    grep -Eq "$pattern" "$path"
  fi
}

check_file() {
  local path="$1"
  local message="$2"
  if [ -e "$path" ]; then
    ok "$message: $path"
  else
    fail "$message: missing $path"
  fi
}

check_dir() {
  local path="$1"
  local message="$2"
  if [ -d "$path" ]; then
    ok "$message: $path"
  else
    fail "$message: missing $path"
  fi
}

printf '== bethel803 staging preflight ==\n'

if command -v node >/dev/null 2>&1; then
  ok "node available: $(node --version)"
else
  fail "node is not installed"
fi

if command -v npm >/dev/null 2>&1; then
  ok "npm available: $(npm --version)"
else
  fail "npm is not installed"
fi

if command -v npx >/dev/null 2>&1; then
  ok "npx available"
else
  fail "npx is not installed"
fi

if command -v gh >/dev/null 2>&1; then
  ok "gh available: $(gh --version | head -n 1)"
  if gh auth status >/dev/null 2>&1; then
    ok "gh auth is configured"
  else
    warn "gh auth is not configured"
  fi
else
  warn "gh is not installed"
fi

if run_with_timeout 20 npx --yes supabase@latest --version >/tmp/bethel803-supabase-version.txt 2>/tmp/bethel803-supabase-version.err; then
  ok "supabase cli available via npx: $(tr -d '\n' < /tmp/bethel803-supabase-version.txt)"
else
  warn "supabase cli check via npx failed or timed out"
fi

if run_with_timeout 20 npx --yes vercel@latest --version >/tmp/bethel803-vercel-version.txt 2>/tmp/bethel803-vercel-version.err; then
  ok "vercel cli available via npx: $(head -n 1 /tmp/bethel803-vercel-version.txt)"
else
  warn "vercel cli check via npx failed or timed out"
fi

check_file ".github/workflows/deploy.yml" "current production workflow"
check_file ".github/workflows/vercel-deploy-manual.yml" "manual vercel workflow"
check_file ".firebaserc" "firebase project marker"
check_file ".env.example" "frontend env example"
check_file "supabase/migrations/013_phase8_push_notifications.sql" "phase 8 migration draft"

check_dir "supabase/functions/fetch-devotional" "existing edge function"
check_dir "supabase/functions/parse-bulletin" "existing edge function"
check_dir "supabase/functions/push-subscriptions" "phase 8 edge function"
check_dir "supabase/functions/push-dispatch" "phase 8 edge function"

if [ -f ".env.local" ]; then
  ok "local env file exists: .env.local"
else
  warn ".env.local does not exist yet"
fi

if [ -f "supabase/config.toml" ]; then
  ok "supabase local config exists"
else
  warn "supabase/config.toml is missing"
fi

if contains_text "Deploy to Firebase Hosting" ".github/workflows/deploy.yml"; then
  ok "firebase workflow is still present for current production operations"
else
  warn "firebase workflow marker not found"
fi

if contains_text "workflow_dispatch" ".github/workflows/vercel-deploy-manual.yml"; then
  ok "manual vercel workflow is dispatch-only"
else
  warn "manual vercel workflow trigger should be reviewed"
fi

printf 'migrations: %s\n' "$(find supabase/migrations -maxdepth 1 -type f | wc -l | tr -d ' ')"
printf 'functions: %s\n' "$(find supabase/functions -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
printf 'disk: %s\n' "$(df -h / | awk 'NR==2 {print $4 " free / " $2 " total (" $5 " used)"}')"

printf '\n'
if [ "$status" -eq 0 ]; then
  printf 'preflight result: PASS (warnings may still require manual follow-up)\n'
else
  printf 'preflight result: FAIL\n'
fi

exit "$status"
