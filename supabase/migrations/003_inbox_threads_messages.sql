-- ============================================================
-- 003_inbox_threads_messages.sql
-- Inbox V1: threads + messages for contact form inquiries.
-- Idempotent: safe to re-run. Does not drop data.
-- ============================================================

-- ── inbox_threads ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbox_threads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  source          TEXT NOT NULL DEFAULT 'website_form',
  subject         TEXT,
  status          TEXT NOT NULL DEFAULT 'new',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 days'),
  archived_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS inbox_threads_tenant_idx        ON inbox_threads(tenant_id);
CREATE INDEX IF NOT EXISTS inbox_threads_customer_idx      ON inbox_threads(customer_id);
CREATE INDEX IF NOT EXISTS inbox_threads_status_idx        ON inbox_threads(tenant_id, status);
CREATE INDEX IF NOT EXISTS inbox_threads_last_msg_idx      ON inbox_threads(tenant_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS inbox_threads_expires_idx       ON inbox_threads(expires_at);

DROP TRIGGER IF EXISTS inbox_threads_set_updated_at ON inbox_threads;
CREATE TRIGGER inbox_threads_set_updated_at
  BEFORE UPDATE ON inbox_threads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── inbox_messages ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbox_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id   UUID NOT NULL REFERENCES inbox_threads(id) ON DELETE CASCADE,
  direction   TEXT NOT NULL DEFAULT 'inbound',
  channel     TEXT NOT NULL DEFAULT 'web_form',
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inbox_messages_thread_idx ON inbox_messages(thread_id, created_at);
