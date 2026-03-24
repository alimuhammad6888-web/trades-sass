-- ============================================================
-- 000_full_schema.sql
-- Complete schema + seed data for local development
-- Run via: npx supabase db reset
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ── Enums ────────────────────────────────────────────────────
CREATE TYPE user_role       AS ENUM ('owner', 'staff', 'admin');
CREATE TYPE booking_status  AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
CREATE TYPE message_channel AS ENUM ('sms', 'email', 'chatbot', 'internal');
CREATE TYPE message_dir     AS ENUM ('inbound', 'outbound', 'system');
CREATE TYPE day_of_week     AS ENUM ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'failed');
CREATE TYPE campaign_channel AS ENUM ('email', 'facebook', 'instagram', 'google_business');

-- ── Helper functions ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM users
  WHERE auth_user_id = auth.uid() AND is_active = TRUE LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role AS $$
  SELECT role FROM users
  WHERE auth_user_id = auth.uid() AND is_active = TRUE LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
  SELECT auth_user_role() = 'owner';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Core tables ───────────────────────────────────────────────

CREATE TABLE tenants (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  plan       TEXT NOT NULL DEFAULT 'free',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE business_settings (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  logo_url                 TEXT,
  primary_color            TEXT DEFAULT '#1C3D5A',
  accent_color             TEXT DEFAULT '#3B82C4',
  bg_color                 TEXT DEFAULT '#ffffff',
  text_color               TEXT DEFAULT '#1a1917',
  tagline                  TEXT,
  phone                    TEXT,
  email                    TEXT,
  website                  TEXT,
  address_line1            TEXT,
  city                     TEXT,
  state                    TEXT,
  zip                      TEXT,
  country                  TEXT DEFAULT 'US',
  timezone                 TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  currency                 TEXT NOT NULL DEFAULT 'USD',
  booking_lead_time_hours  INT NOT NULL DEFAULT 2,
  booking_window_days      INT NOT NULL DEFAULT 60,
  auto_confirm_bookings    BOOLEAN NOT NULL DEFAULT FALSE,
  sms_enabled              BOOLEAN NOT NULL DEFAULT FALSE,
  email_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  chatbot_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  chatbot_greeting         TEXT DEFAULT 'Hi! How can I help you today?',
  chatbot_persona          TEXT DEFAULT 'friendly assistant',
  border_radius            TEXT DEFAULT 'soft',
  font_style               TEXT DEFAULT 'sans',
  facebook_page_token      TEXT,
  instagram_user_token     TEXT,
  google_business_token    TEXT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE business_hours (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day        day_of_week NOT NULL,
  is_open    BOOLEAN NOT NULL DEFAULT TRUE,
  open_time  TIME,
  close_time TIME,
  UNIQUE (tenant_id, day)
);

CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  role         user_role NOT NULL DEFAULT 'staff',
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE customers (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  first_name           TEXT NOT NULL,
  last_name            TEXT,
  email                TEXT,
  phone                TEXT,
  notes                TEXT,
  lead_source          TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  email_subscribed     BOOLEAN NOT NULL DEFAULT FALSE,
  email_subscribed_at  TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE services (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  duration_mins INT NOT NULL DEFAULT 60,
  price_cents   INT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bookings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  service_id          UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  assigned_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  status              booking_status NOT NULL DEFAULT 'pending',
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ NOT NULL,
  price_cents         INT,
  notes               TEXT,
  internal_notes      TEXT,
  confirmed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  sms_ref             TEXT UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_booking_window CHECK (ends_at > starts_at)
);

-- Double-booking prevention
ALTER TABLE bookings ADD CONSTRAINT no_double_booking
  EXCLUDE USING GIST (
    tenant_id        WITH =,
    assigned_user_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (assigned_user_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show'));

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id      UUID REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  channel         message_channel NOT NULL,
  direction       message_dir NOT NULL,
  body            TEXT NOT NULL,
  provider_id     TEXT,
  provider_status TEXT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chatbot_conversations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL,
  is_resolved   BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chatbot_turns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES chatbot_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  extracted_data  JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inbox_emails (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_email  TEXT NOT NULL,
  from_name   TEXT,
  to_email    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body_text   TEXT,
  body_html   TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  is_starred  BOOLEAN NOT NULL DEFAULT FALSE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  provider_id TEXT UNIQUE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE campaigns (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  channels      campaign_channel[] NOT NULL DEFAULT '{}',
  status        campaign_status NOT NULL DEFAULT 'draft',
  scheduled_for TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  email_subject TEXT,
  sent_count    INT DEFAULT 0,
  open_count    INT DEFAULT 0,
  click_count   INT DEFAULT 0,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_invites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'staff',
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '48 hours',
  accepted_at TIMESTAMPTZ,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_users_tenant        ON users(tenant_id);
CREATE INDEX idx_users_auth          ON users(auth_user_id);
CREATE INDEX idx_customers_tenant    ON customers(tenant_id);
CREATE INDEX idx_services_tenant     ON services(tenant_id);
CREATE INDEX idx_bookings_tenant     ON bookings(tenant_id);
CREATE INDEX idx_bookings_time       ON bookings(tenant_id, starts_at);
CREATE INDEX idx_bookings_status     ON bookings(tenant_id, status);
CREATE INDEX idx_messages_tenant     ON messages(tenant_id);
CREATE INDEX idx_messages_booking    ON messages(booking_id);
CREATE INDEX idx_inbox_tenant        ON inbox_emails(tenant_id, received_at DESC);
CREATE INDEX idx_inbox_unread        ON inbox_emails(tenant_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_campaigns_tenant    ON campaigns(tenant_id, created_at DESC);
CREATE INDEX idx_chatbot_conv_tenant ON chatbot_conversations(tenant_id);

-- ── Triggers ─────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants','business_settings','users','customers',
    'services','bookings','chatbot_conversations','campaigns'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END; $$;

-- ── New user trigger ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE v_tenant_id UUID; v_role user_role;
BEGIN
  v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  v_role      := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'staff');
  IF v_tenant_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO users(tenant_id, auth_user_id, role, first_name, last_name, email, is_active)
  VALUES(v_tenant_id, NEW.id, v_role,
    COALESCE(NEW.raw_user_meta_data->>'first_name',''),
    COALESCE(NEW.raw_user_meta_data->>'last_name',''),
    NEW.email, TRUE)
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── RLS ──────────────────────────────────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'tenants','business_settings','business_hours','users',
    'customers','services','bookings','messages',
    'chatbot_conversations','chatbot_turns',
    'inbox_emails','campaigns','staff_invites'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
  END LOOP;
END; $$;

-- Tenant isolation policies
CREATE POLICY "tenants_select" ON tenants FOR SELECT USING (id = auth_tenant_id());

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'business_settings','business_hours','users','customers',
    'services','bookings','messages','chatbot_conversations',
    'chatbot_turns','inbox_emails','campaigns','staff_invites'
  ] LOOP
    EXECUTE format('CREATE POLICY "%s_select" ON %I FOR SELECT USING (tenant_id = auth_tenant_id())', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_insert" ON %I FOR INSERT WITH CHECK (tenant_id = auth_tenant_id())', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_update" ON %I FOR UPDATE USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id())', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_delete" ON %I FOR DELETE USING (tenant_id = auth_tenant_id())', tbl, tbl);
  END LOOP;
END; $$;

-- Public read for customer-facing pages
CREATE POLICY "services_public_read"          ON services          FOR SELECT USING (is_active = TRUE);
CREATE POLICY "business_settings_public_read" ON business_settings FOR SELECT USING (TRUE);
CREATE POLICY "business_hours_public_read"    ON business_hours    FOR SELECT USING (TRUE);
CREATE POLICY "chatbot_conv_anon_insert"      ON chatbot_conversations FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "chatbot_turns_anon_insert"     ON chatbot_turns     FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "inbox_webhook_insert"          ON inbox_emails      FOR INSERT WITH CHECK (TRUE);

-- ── SEED DATA ────────────────────────────────────────────────
-- Demo tenant for local development

INSERT INTO tenants (id, slug, name, plan) VALUES
  ('11111111-1111-1111-1111-111111111111', 'demo-plumbing', 'Joe''s Plumbing & HVAC', 'pro');

INSERT INTO business_settings (tenant_id, primary_color, accent_color, tagline, phone, email, timezone, chatbot_enabled) VALUES
  ('11111111-1111-1111-1111-111111111111', '#1C3D5A', '#3B82C4',
   'Fast, reliable, and honest since 1998.', '(555) 210-4400',
   'joe@joesplumbing.com', 'America/Los_Angeles', TRUE);

INSERT INTO business_hours (tenant_id, day, is_open, open_time, close_time) VALUES
  ('11111111-1111-1111-1111-111111111111', 'mon', TRUE,  '08:00', '17:00'),
  ('11111111-1111-1111-1111-111111111111', 'tue', TRUE,  '08:00', '17:00'),
  ('11111111-1111-1111-1111-111111111111', 'wed', TRUE,  '08:00', '17:00'),
  ('11111111-1111-1111-1111-111111111111', 'thu', TRUE,  '08:00', '17:00'),
  ('11111111-1111-1111-1111-111111111111', 'fri', TRUE,  '08:00', '17:00'),
  ('11111111-1111-1111-1111-111111111111', 'sat', TRUE,  '09:00', '13:00'),
  ('11111111-1111-1111-1111-111111111111', 'sun', FALSE, NULL,    NULL);

INSERT INTO services (tenant_id, name, description, duration_mins, price_cents, display_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Drain Clearing',    'Fast hydro-jetting for stubborn blockages.',               60,  9900,  1),
  ('11111111-1111-1111-1111-111111111111', 'Water Heater',      'Install or repair — same day availability.',              180, 29900, 2),
  ('11111111-1111-1111-1111-111111111111', 'Leak Detection',    'Pinpoint hidden leaks without tearing walls.',            120, 14900, 3),
  ('11111111-1111-1111-1111-111111111111', 'HVAC Tune-Up',      'Pre-season check to maximise efficiency.',                90,  8900,  4),
  ('11111111-1111-1111-1111-111111111111', 'Pipe Repair',       'Copper, PVC, PEX — all materials handled.',              120, NULL,   5),
  ('11111111-1111-1111-1111-111111111111', 'Safety Inspection', 'Full plumbing audit with written report.',                120, 14900, 6);

INSERT INTO customers (id, tenant_id, first_name, last_name, email, phone, lead_source, email_subscribed) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Marcus', 'Webb',   'm.webb@email.com',      '(555) 210-1001', 'chatbot', TRUE),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Linda',  'Torres', 'l.torres@gmail.com',    '(555) 334-8821', 'website', TRUE),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Ray',    'Okonkwo','ray.o@work.com',         '(555) 671-2234', 'referral',FALSE),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Sarah',  'Kim',    'sarah.kim@email.com',   '(555) 980-1103', 'chatbot', TRUE),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'David',  'Fitch',  'dfitch@gmail.com',      '(555) 445-7720', 'website', FALSE),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'Anna',   'Schulz', 'anna.s@email.com',      '(555) 892-0034', 'chatbot', TRUE);

-- Bookings spread across last 30 days + upcoming
INSERT INTO bookings (tenant_id, customer_id, service_id, status, starts_at, ends_at, price_cents) VALUES
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(SELECT id FROM services WHERE name='Drain Clearing' AND tenant_id='11111111-1111-1111-1111-111111111111'),'completed', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days' + INTERVAL '1 hour', 9900),
  ('11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',(SELECT id FROM services WHERE name='Water Heater' AND tenant_id='11111111-1111-1111-1111-111111111111'),'completed', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days' + INTERVAL '3 hours', 29900),
  ('11111111-1111-1111-1111-111111111111','cccccccc-cccc-cccc-cccc-cccccccccccc',(SELECT id FROM services WHERE name='Leak Detection' AND tenant_id='11111111-1111-1111-1111-111111111111'),'completed', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days' + INTERVAL '2 hours', 14900),
  ('11111111-1111-1111-1111-111111111111','dddddddd-dddd-dddd-dddd-dddddddddddd',(SELECT id FROM services WHERE name='HVAC Tune-Up' AND tenant_id='11111111-1111-1111-1111-111111111111'),'completed', NOW() - INTERVAL '5 days',  NOW() - INTERVAL '5 days'  + INTERVAL '90 minutes', 8900),
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(SELECT id FROM services WHERE name='Drain Clearing' AND tenant_id='11111111-1111-1111-1111-111111111111'),'confirmed', NOW() + INTERVAL '1 day',   NOW() + INTERVAL '1 day'   + INTERVAL '1 hour', 9900),
  ('11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',(SELECT id FROM services WHERE name='Water Heater' AND tenant_id='11111111-1111-1111-1111-111111111111'),'confirmed', NOW() + INTERVAL '2 days',  NOW() + INTERVAL '2 days'  + INTERVAL '3 hours', 29900),
  ('11111111-1111-1111-1111-111111111111','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',(SELECT id FROM services WHERE name='Pipe Repair' AND tenant_id='11111111-1111-1111-1111-111111111111'),'pending',   NOW() + INTERVAL '4 days',  NOW() + INTERVAL '4 days'  + INTERVAL '2 hours', NULL),
  ('11111111-1111-1111-1111-111111111111','ffffffff-ffff-ffff-ffff-ffffffffffff',(SELECT id FROM services WHERE name='Safety Inspection' AND tenant_id='11111111-1111-1111-1111-111111111111'),'confirmed',NOW() + INTERVAL '6 days',  NOW() + INTERVAL '6 days'  + INTERVAL '2 hours', 14900);

-- Sample inbox emails
INSERT INTO inbox_emails (tenant_id, from_email, from_name, to_email, subject, body_text, is_read, customer_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'm.webb@email.com', 'Marcus Webb', 'demo-plumbing@mail.yourplatform.com', 'Re: Drain clearing appointment', 'Thanks! Tuesday at 9am works great.', FALSE, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('11111111-1111-1111-1111-111111111111', 'l.torres@gmail.com', 'Linda Torres', 'demo-plumbing@mail.yourplatform.com', 'Question about water heater pricing', 'Hi, I saw your website and wanted to ask about a 40-gallon replacement. Do you offer same-day service?', FALSE, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('11111111-1111-1111-1111-111111111111', 'office@pinecrest.com', 'Pinecrest Management', 'demo-plumbing@mail.yourplatform.com', 'Commercial contract inquiry — 4 units', 'We manage four properties and are looking for a plumber on retainer. 8-12 calls per month. Open to discuss?', FALSE, NULL);

-- Sample campaigns
INSERT INTO campaigns (tenant_id, title, body, channels, status, email_subject, sent_at, sent_count, open_count) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Spring HVAC tune-up special', 'Spring is here! Book your annual HVAC tune-up this month and get 20% off. Limited slots available.', ARRAY['email','facebook']::campaign_channel[], 'sent', 'Save 20% on your spring HVAC tune-up', NOW() - INTERVAL '8 days', 142, 61),
  ('11111111-1111-1111-1111-111111111111', 'Same-day drain clearing promo', 'Slow drains? We''ll clear them same day. Mention this message for $20 off.', ARRAY['email','instagram']::campaign_channel[], 'sent', 'Same-day drain service — $20 off', NOW() - INTERVAL '15 days', 138, 55);
