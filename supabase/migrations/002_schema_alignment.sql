-- ============================================================
-- 002_schema_alignment.sql
-- Align schema with code:
--   * Add missing columns to business_settings
--   * Create staff / staff_availability tables
-- Idempotent: safe to re-run. Does not drop data.
-- ============================================================

-- ── business_settings: missing columns ──────────────────────
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS features            JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dashboard_theme     TEXT  NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS notification_email  TEXT,
  ADD COLUMN IF NOT EXISTS notification_phone  TEXT;

-- ── staff ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'technician',
  color       TEXT NOT NULL DEFAULT '#3B82C4',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS staff_tenant_idx ON staff(tenant_id);

DROP TRIGGER IF EXISTS staff_set_updated_at ON staff;
CREATE TRIGGER staff_set_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── staff_availability ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_availability (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id    UUID NOT NULL REFERENCES staff(id)   ON DELETE CASCADE,
  day         day_of_week NOT NULL,
  is_working  BOOLEAN NOT NULL DEFAULT FALSE,
  start_time  TIME,
  end_time    TIME,
  UNIQUE (staff_id, day)
);

CREATE INDEX IF NOT EXISTS staff_avail_tenant_idx ON staff_availability(tenant_id);
CREATE INDEX IF NOT EXISTS staff_avail_staff_idx  ON staff_availability(staff_id);
