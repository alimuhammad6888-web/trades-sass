# TradesSaaS — Local Setup & Demo Guide

Complete white-label booking platform for trades businesses.
Built with Next.js 14, Supabase, OpenAI, Twilio, and Resend.

---

## What you need before starting

| Tool | Version | Free? | Link |
|---|---|---|---|
| Node.js | 18+ | ✓ | nodejs.org |
| Docker Desktop | any | ✓ | docker.com |
| Supabase CLI | any | ✓ | `npm i -g supabase` |
| Git | any | ✓ | git-scm.com |

**Cost to run locally: $0.** All external APIs run as mocks.
**Cost to demo live (with real SMS/AI): ~$2–5** for a full demo session.

---

## Quick start (5 minutes)

```bash
# 1. Clone and enter the project
git clone <your-repo> trades-saas
cd trades-saas

# 2. Run the one-command setup
bash scripts/setup.sh
```

That's it. The script will:
- Check your prerequisites
- Install npm packages
- Start Supabase locally (Docker)
- Run the database migrations + seed data
- Create a demo owner login

**Then open two terminals:**

```bash
# Terminal 1 — mock API server (free AI, SMS, email)
npm run mock

# Terminal 2 — Next.js dev server
npm run dev
```

Or run both at once: `npm run dev:full`

---

## Manual setup (if the script fails)

### Step 1 — Install dependencies
```bash
npm install
```

### Step 2 — Start Supabase
```bash
npx supabase start
# Takes 1–2 min on first run (downloads Docker images)
```

### Step 3 — Copy and fill env vars
```bash
cp .env.example .env.local
```

After `supabase start`, run `npx supabase status` — you'll see:
```
API URL:        http://127.0.0.1:54321
anon key:       eyJhbGci...
service_role key: eyJhbGci...
```

Paste those into `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from above>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from above>
```

### Step 4 — Run migrations
```bash
npx supabase db reset --local
# This runs supabase/migrations/000_full_schema.sql
# and seeds the demo data
```

### Step 5 — Create demo user
```bash
node scripts/create-demo-user.js
```

### Step 6 — Start everything
```bash
npm run mock   # Terminal 1
npm run dev    # Terminal 2
```

---

## Navigating the app locally

| URL | What it is |
|---|---|
| `http://localhost:3000/dashboard` | Owner dashboard (login required) |
| `http://localhost:3000/book` | Customer booking page |
| `http://localhost:3000/book?tenant=demo-plumbing` | Explicit tenant (same result locally) |
| `http://127.0.0.1:54323` | Supabase Studio (browse DB, run SQL) |
| `http://127.0.0.1:54324` | Inbucket (catches all emails locally) |

### Demo login
```
Email:    owner@demo.com
Password: Demo1234!
```

---

## Feature testing checklist

### ✅ Booking flow (customer-facing)
1. Go to `http://localhost:3000/book`
2. Select a service → pick a date → choose a time slot
3. Enter test details (any name, phone, email)
4. Submit — you should see the confirmation screen
5. Check the dashboard at `/dashboard` — the booking appears under "Upcoming"
6. Check the mock server terminal — you'll see `[mock-sms] → To: ...` logged

### ✅ Dashboard KPIs
- Login at `/dashboard/login` with `owner@demo.com` / `Demo1234!`
- Overview shows 4 KPI cards populated from seed data
- Click Bookings, Customers, Outreach tabs

### ✅ Chatbot
1. Go to `/book` — the chat bubble is bottom-right
2. Type: "I need help with a drain"
3. The mock AI responds (cycles through preset replies)
4. On the 3rd message it captures a lead — check Supabase Studio:
   `SELECT * FROM customers ORDER BY created_at DESC LIMIT 5;`

### ✅ Inbox
1. Go to `/dashboard/outreach` → Inbox tab
2. Seed data includes 3 sample emails
3. Click an email to read it — it marks as read

### ✅ Campaigns
1. Go to `/dashboard/outreach` → Campaigns tab
2. Click "+ New" → fill in a title and message
3. Select channels (Email, Facebook, etc.)
4. Click "Send now" — watch the mock server terminal log the email sends

### ✅ Branding
1. Go to `/dashboard/settings` → Branding tab
2. Change the primary color — the live preview updates instantly
3. Click "Save branding" — then reload `/book` to see the new colors applied

### ✅ Availability
1. Go to `/dashboard/availability`
2. Toggle Saturday off → Save
3. Go to `/book` → pick a date — Saturdays no longer appear

---

## Simulating a second tenant

To demo white-labelling with two different businesses:

```sql
-- Run in Supabase Studio (http://127.0.0.1:54323)
INSERT INTO tenants (id, slug, name) VALUES
  ('22222222-2222-2222-2222-222222222222', 'alpine-hvac', 'Alpine HVAC');

INSERT INTO business_settings (tenant_id, primary_color, accent_color, phone, tagline) VALUES
  ('22222222-2222-2222-2222-222222222222', '#1D4E35', '#34A668',
   '(555) 873-0011', 'Climate control done right.');

INSERT INTO business_hours (tenant_id, day, is_open, open_time, close_time) VALUES
  ('22222222-2222-2222-2222-222222222222', 'mon', TRUE, '08:00', '17:00'),
  ('22222222-2222-2222-2222-222222222222', 'tue', TRUE, '08:00', '17:00'),
  ('22222222-2222-2222-2222-222222222222', 'wed', TRUE, '08:00', '17:00'),
  ('22222222-2222-2222-2222-222222222222', 'thu', TRUE, '08:00', '17:00'),
  ('22222222-2222-2222-2222-222222222222', 'fri', TRUE, '08:00', '17:00'),
  ('22222222-2222-2222-2222-222222222222', 'sat', FALSE, NULL, NULL),
  ('22222222-2222-2222-2222-222222222222', 'sun', FALSE, NULL, NULL);

INSERT INTO services (tenant_id, name, duration_mins, price_cents) VALUES
  ('22222222-2222-2222-2222-222222222222', 'AC Installation',   480, 180000),
  ('22222222-2222-2222-2222-222222222222', 'Seasonal Tune-Up',   90,   8900),
  ('22222222-2222-2222-2222-222222222222', 'Furnace Repair',    120,  12900),
  ('22222222-2222-2222-2222-222222222222', 'Duct Cleaning',     180,  29900);
```

Then visit: `http://localhost:3000/book?tenant=alpine-hvac`

You'll see a completely different brand — green colors, HVAC services, different tagline — running from the same codebase.

---

## Going live (when you have a real client)

### Step 1 — Supabase (free tier works for MVP)
1. Create account at supabase.com
2. New project → copy URL + keys to production env vars
3. Run: `npx supabase db push` to apply your schema

### Step 2 — OpenAI ($5 credit covers many demos)
1. platform.openai.com → API keys → create key
2. Set `OPENAI_API_KEY=sk-...` and `USE_MOCK_AI=false`

### Step 3 — Twilio (free trial = $15 credit)
1. twilio.com → sign up → get a phone number (free)
2. Set your 3 Twilio env vars and `USE_MOCK_SMS=false`

### Step 4 — Resend (free tier: 3,000 emails/month)
1. resend.com → create account → API key
2. Verify your domain (takes ~5 min)
3. Set `RESEND_API_KEY=re_...` and `USE_MOCK_EMAIL=false`

### Step 5 — Deploy to Vercel (free hobby tier)
```bash
npm install -g vercel
vercel          # follow prompts
vercel env add  # add all env vars from .env.local
vercel --prod   # deploy
```

Add your domain + wildcard subdomain in Vercel dashboard.
Set DNS: `*.yourdomain.com → CNAME → cname.vercel-dns.com`

---

## Useful commands

```bash
npm run db:reset      # Wipe and re-seed database
npm run db:studio     # Open Supabase Studio in browser
npm run supabase:stop # Stop local Supabase (frees Docker resources)
npm run demo:user     # Re-create the demo owner account

# Reset everything from scratch
npx supabase stop
npx supabase start
npx supabase db reset --local
node scripts/create-demo-user.js
```

## Troubleshooting

**"supabase start" hangs or fails**
→ Make sure Docker Desktop is running and has at least 4GB RAM allocated.

**"relation does not exist" errors**
→ Run `npx supabase db reset --local` to re-apply migrations.

**Mock AI not responding**
→ Make sure `node scripts/mock-services.js` is running in a separate terminal.

**Booking slots show empty**
→ Seed data bookings are in the future. The date picker only shows days with open hours. Check `business_hours` in Supabase Studio.

**Can't log in to dashboard**
→ Run `node scripts/create-demo-user.js` again. Check `.env.local` has the correct Supabase keys.
