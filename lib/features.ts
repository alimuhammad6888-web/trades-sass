// lib/features.ts
// Central feature gate for plan-based access control.
//
// Source of truth order:
//   1. Plan defaults (starter / pro / enterprise)
//   2. Explicit tenant.features overrides (can grant OR revoke)
//
// Legacy plan names (free, tier1, tier2, tier3) are aliased to
// canonical plan names before lookup.
//
// Legacy feature keys stored in older tenant.features rows are
// aliased to their canonical equivalents before evaluation.

// ── Canonical feature keys ────────────────────────────────────

export type FeatureKey =
  | 'website'
  | 'booking'
  | 'email_confirmation'
  | 'payments'
  | 'sms_notifications'
  | 'custom_domain'
  | 'ai_chatbot'
  | 'social_automation'
  | 'staff_management'
  | 'advanced_crm'

// ── Plan name aliases ─────────────────────────────────────────
// Maps old stored plan names to canonical plan names.

const PLAN_ALIASES: Record<string, string> = {
  free:  'starter',
  tier1: 'starter',
  tier2: 'pro',
  tier3: 'enterprise',
}

// ── Plan feature sets ─────────────────────────────────────────

export const PLAN_FEATURES: Record<string, FeatureKey[]> = {
  starter: [
    'website',
    'booking',
    'email_confirmation',
  ],
  pro: [
    'website',
    'booking',
    'email_confirmation',
    'payments',
    'sms_notifications',
    'custom_domain',
  ],
  enterprise: [
    'website',
    'booking',
    'email_confirmation',
    'payments',
    'sms_notifications',
    'custom_domain',
    'ai_chatbot',
    'social_automation',
    'staff_management',
    'advanced_crm',
  ],
}

// ── Legacy feature key aliases ────────────────────────────────
// Maps old stored keys to canonical FeatureKey equivalents.
// Canonical keys take precedence when both exist on tenant.features.

const LEGACY_FEATURE_ALIASES: Record<string, FeatureKey> = {
  chatbot:      'ai_chatbot',
  sms:          'sms_notifications',
  campaigns:    'social_automation',
  inbox:        'advanced_crm',
  custom_domain: 'custom_domain',  // unchanged — listed for completeness
}

// ── All canonical keys as a Set for O(1) lookup ───────────────

const CANONICAL_KEYS = new Set<string>(PLAN_FEATURES.enterprise)

// ── Tenant shape ──────────────────────────────────────────────
// Intentionally loose — compatible with Tenant from lib/tenant.ts
// and the inline Tenant type in BookingFlow.tsx.

type FeatureCapable = {
  plan?: string | null
  features?: Record<string, boolean | null | undefined> | null
}

// ── Internal helpers ──────────────────────────────────────────

/**
 * Resolves a raw plan name (including legacy aliases) to a
 * canonical plan name, or null if unrecognised.
 */
function resolvePlan(plan: string | null | undefined): string | null {
  if (!plan) return null
  if (PLAN_FEATURES[plan]) return plan
  return PLAN_ALIASES[plan] ?? null
}

/**
 * Returns the set of FeatureKeys included in a plan.
 * Resolves legacy plan aliases. Unknown plans return empty set.
 */
function planFeatureSet(plan: string | null | undefined): Set<FeatureKey> {
  const canonical = resolvePlan(plan)
  if (!canonical) return new Set()
  return new Set(PLAN_FEATURES[canonical] ?? [])
}

/**
 * Resolves a stored key (canonical or legacy alias) to a FeatureKey.
 * Returns null if unrecognised.
 */
function resolveFeatureKey(key: string): FeatureKey | null {
  if (CANONICAL_KEYS.has(key)) return key as FeatureKey
  return LEGACY_FEATURE_ALIASES[key] ?? null
}

/**
 * Builds a Map of canonical FeatureKey → boolean from the raw
 * tenant.features object, resolving both canonical and legacy keys.
 * Canonical keys take precedence over legacy aliases.
 */
function resolveOverrides(
  raw: Record<string, boolean | null | undefined> | null | undefined
): Map<FeatureKey, boolean> {
  const result = new Map<FeatureKey, boolean>()
  if (!raw) return result

  // First pass: resolve all keys (canonical and alias)
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue
    const canonical = resolveFeatureKey(key)
    if (!canonical) continue
    if (!result.has(canonical)) {
      result.set(canonical, value)
    }
  }

  // Second pass: canonical keys overwrite alias-derived values
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue
    if (CANONICAL_KEYS.has(key)) {
      result.set(key as FeatureKey, value)
    }
  }

  return result
}

// ── Primary exports ───────────────────────────────────────────

/**
 * hasFeature(tenant, feature)
 *
 * Returns true if the feature is enabled for this tenant.
 *
 * Resolution order:
 *   1. Plan defaults — starter / pro / enterprise (legacy names resolved)
 *   2. Explicit tenant.features overrides — can grant OR revoke access
 *
 * Safe when tenant, plan, or features are null/undefined.
 *
 * Examples:
 *   hasFeature(tenant, 'payments')
 *   hasFeature(tenant, 'ai_chatbot')
 *   hasFeature(tenant, 'sms_notifications')
 */
export function hasFeature(
  tenant: FeatureCapable | null | undefined,
  feature: FeatureKey
): boolean {
  const fromPlan  = planFeatureSet(tenant?.plan).has(feature)
  const overrides = resolveOverrides(tenant?.features)

  if (overrides.has(feature)) {
    return overrides.get(feature)!
  }

  return fromPlan
}

/**
 * getPlanFeatures(plan)
 *
 * Returns the full list of FeatureKeys included in a plan.
 * Resolves legacy plan aliases.
 * Useful for plan comparison UI and seeding new tenants.
 */
export function getPlanFeatures(plan: string): FeatureKey[] {
  const canonical = resolvePlan(plan)
  if (!canonical) return []
  return PLAN_FEATURES[canonical] ?? []
}

/**
 * minimumPlanFor(feature)
 *
 * Returns the lowest canonical plan that includes a feature,
 * or null if no plan includes it.
 * Useful for upgrade prompt copy: "Available on Pro and above."
 */
export function minimumPlanFor(feature: FeatureKey): string | null {
  for (const plan of ['starter', 'pro', 'enterprise']) {
    if (PLAN_FEATURES[plan]?.includes(feature)) return plan
  }
  return null
}

/**
 * resolvePlanName(plan)
 *
 * Normalises a stored plan name to its canonical form.
 * Useful when displaying plan names in UI.
 * Returns null for unrecognised plan names.
 */
export function resolvePlanName(plan: string | null | undefined): string | null {
  return resolvePlan(plan)
}