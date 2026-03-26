// lib/tenant.ts
// Single source of truth for resolving the current tenant.
// All pages and components read from here — never hardcode TENANT_ID.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type TenantFeatures = {
  chatbot:       boolean
  sms:           boolean
  campaigns:     boolean
  inbox:         boolean
  custom_domain: boolean
}

export type Tenant = {
  id:       string
  name:     string
  slug:     string
  plan:     string
  features: TenantFeatures
}

// Default features — all off
export const DEFAULT_FEATURES: TenantFeatures = {
  chatbot:       false,
  sms:           false,
  campaigns:     false,
  inbox:         false,
  custom_domain: false,
}

// ── Client-side tenant resolver ───────────────────────────────
// Used in client components. Reads slug from URL param or hostname.

export async function resolveTenant(): Promise<Tenant | null> {
  const slug = getTenantSlug()
  if (!slug) return null

  const { data } = await supabase
    .from('tenants')
    .select(`
      id, name, slug, plan,
      business_settings ( features )
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!data) return null

  const settings = Array.isArray(data.business_settings)
    ? data.business_settings[0]
    : data.business_settings

  return {
    id:       data.id,
    name:     data.name,
    slug:     data.slug,
    plan:     data.plan,
    features: { ...DEFAULT_FEATURES, ...(settings?.features ?? {}) },
  }
}

// ── Get slug from URL ─────────────────────────────────────────
// Localhost: ?tenant=demo-plumbing or default
// Production: subdomain e.g. joe-plumbing.yourapp.com

export function getTenantSlug(): string {
  if (typeof window === 'undefined') return 'demo-plumbing'

  // Check URL param first (local dev)
  const param = new URLSearchParams(window.location.search).get('tenant')
  if (param) return param

  // Check subdomain (production)
  const host = window.location.hostname
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('vercel.app')
  if (!isLocalhost) {
    const subdomain = host.split('.')[0]
    if (subdomain) return subdomain
  }

  // Default to demo tenant for local dev
  return 'demo-plumbing'
}

// ── Feature gate hook ─────────────────────────────────────────
// Returns whether a feature is enabled for the current tenant.
// Use this in any component to check before rendering locked features.

export function isFeatureEnabled(features: TenantFeatures, feature: keyof TenantFeatures): boolean {
  return features[feature] === true
}

// ── Plan tier helpers ─────────────────────────────────────────

export const PLAN_FEATURES: Record<string, (keyof TenantFeatures)[]> = {
  free:       [],
  pro:        ['chatbot', 'sms', 'campaigns', 'inbox'],
  enterprise: ['chatbot', 'sms', 'campaigns', 'inbox', 'custom_domain'],
}

export const PLAN_LABELS: Record<string, string> = {
  free:       'Free',
  pro:        'Pro — $99/mo',
  enterprise: 'Enterprise — $249/mo',
}
