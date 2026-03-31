-- ============================================================
-- 001_tenant_site_content.sql
-- Website content table for tenant public sites.
-- ============================================================

CREATE TABLE public.tenant_site_content (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  hero_headline      TEXT DEFAULT 'Your trusted local experts',
  hero_subheadline   TEXT DEFAULT 'Licensed, insured, and ready to help.',
  hero_badge         TEXT DEFAULT 'Now accepting online bookings',
  stats_json         JSONB DEFAULT '[
    {"value":"500+","label":"Jobs completed"},
    {"value":"4.9★","label":"Google rating"},
    {"value":"24hr","label":"Response time"}
  ]'::jsonb,
  why_us_json        JSONB DEFAULT '[
    {"icon":"🛡️","title":"Licensed & insured","desc":"Full coverage on every job"},
    {"icon":"⚡","title":"Same-day availability","desc":"We work around your schedule"},
    {"icon":"💬","title":"Upfront pricing","desc":"No surprises, no hidden fees"}
  ]'::jsonb,
  cta_primary_text   TEXT DEFAULT 'Book a service',
  cta_secondary_text TEXT DEFAULT 'Ready to get started?',
  cta_description    TEXT DEFAULT '',
  footer_tagline     TEXT DEFAULT 'Proudly serving our local community.',
  is_published       BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id)
);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.tenant_site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read own site content"
  ON public.tenant_site_content FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "Tenant users can update own site content"
  ON public.tenant_site_content FOR UPDATE
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "Tenant users can insert own site content"
  ON public.tenant_site_content FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());

-- Service role bypasses RLS, so public API route works without extra policy.

-- ── Auto-update updated_at ─────────────────────────────────────
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.tenant_site_content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
