#!/usr/bin/env bash
# scripts/setup.sh
# One-command local setup. Run: bash scripts/setup.sh
# ─────────────────────────────────────────────────────────────
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${YELLOW}──${NC} $1"; }

echo ""
echo "  ┌──────────────────────────────────┐"
echo "  │  TradesSaaS — Local Setup        │"
echo "  └──────────────────────────────────┘"
echo ""

# ── Check prerequisites ───────────────────────────────────────
step "Checking prerequisites"

command -v node  >/dev/null 2>&1 || err "Node.js not found. Install from nodejs.org (v18+)"
command -v npm   >/dev/null 2>&1 || err "npm not found"
command -v npx   >/dev/null 2>&1 || err "npx not found"

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
[ "$NODE_VERSION" -ge 18 ] || err "Node.js 18+ required (you have v$NODE_VERSION)"
ok "Node.js $(node -v)"

if ! command -v supabase >/dev/null 2>&1; then
  warn "Supabase CLI not found — installing..."
  npm install -g supabase
fi
ok "Supabase CLI $(supabase --version)"

# Docker check (needed for Supabase local)
if ! command -v docker >/dev/null 2>&1; then
  err "Docker not found. Install Docker Desktop from docker.com then re-run."
fi
if ! docker info >/dev/null 2>&1; then
  err "Docker is not running. Start Docker Desktop then re-run."
fi
ok "Docker running"

# ── Install dependencies ──────────────────────────────────────
step "Installing npm packages"
npm install
ok "Dependencies installed"

# ── Set up environment ────────────────────────────────────────
step "Setting up environment"
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  ok "Created .env.local from .env.example"
else
  warn ".env.local already exists — skipping"
fi

# ── Start Supabase ────────────────────────────────────────────
step "Starting Supabase local stack"
supabase start

# Extract the generated keys and inject into .env.local
SUPA_URL=$(supabase status --output json 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');try{const j=JSON.parse(d);console.log(j.API_URL||'http://127.0.0.1:54321')}catch{console.log('http://127.0.0.1:54321')}")
ANON_KEY=$(supabase status --output json 2>/dev/null  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');try{const j=JSON.parse(d);console.log(j.ANON_KEY||'')}catch{console.log('')}")
SERVICE_KEY=$(supabase status --output json 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');try{const j=JSON.parse(d);console.log(j.SERVICE_ROLE_KEY||'')}catch{console.log('')}")

# Fallback: parse from supabase status text output
if [ -z "$ANON_KEY" ]; then
  ANON_KEY=$(supabase status 2>/dev/null | grep "anon key" | awk '{print $NF}')
  SERVICE_KEY=$(supabase status 2>/dev/null | grep "service_role key" | awk '{print $NF}')
  SUPA_URL=$(supabase status 2>/dev/null | grep "API URL" | awk '{print $NF}')
fi

if [ -n "$ANON_KEY" ]; then
  # Update .env.local with real local values
  sed -i.bak "s|NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=${SUPA_URL}|" .env.local
  sed -i.bak "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}|" .env.local
  sed -i.bak "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}|" .env.local
  rm -f .env.local.bak
  ok "Supabase keys injected into .env.local"
else
  warn "Could not auto-inject keys — copy them manually from 'supabase status'"
fi

# ── Run migrations ────────────────────────────────────────────
step "Running database migrations"
supabase db reset --local
ok "Schema + seed data applied"

# ── Create demo owner account ─────────────────────────────────
step "Creating demo owner account"
node scripts/create-demo-user.js || warn "Could not create demo user — run manually"

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "  ┌──────────────────────────────────────────────────────┐"
echo "  │  Setup complete!                                      │"
echo "  │                                                       │"
echo "  │  Start dev:                                          │"
echo "  │    Terminal 1: node scripts/mock-services.js         │"
echo "  │    Terminal 2: npm run dev                           │"
echo "  │                                                       │"
echo "  │  Open:                                               │"
echo "  │    App:      http://localhost:3000                   │"
echo "  │    Booking:  http://localhost:3000/book              │"
echo "  │    Dashboard:http://localhost:3000/dashboard         │"
echo "  │    DB UI:    http://127.0.0.1:54323                  │"
echo "  │                                                       │"
echo "  │  Demo login:                                         │"
echo "  │    Email: owner@demo.com                             │"
echo "  │    Pass:  Demo1234!                                  │"
echo "  └──────────────────────────────────────────────────────┘"
echo ""
