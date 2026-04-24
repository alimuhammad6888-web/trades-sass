import { type BillingRecord, hasBillingAccess } from './billing'
import { type FeatureKey, hasFeature } from './features'

type EntitlementTenant = {
  plan?: string | null
  features?: Record<string, boolean | null | undefined> | null
} | null | undefined

const BILLING_REQUIRED_FEATURES = new Set<FeatureKey>([
  'advanced_crm',
  'social_automation',
  'payments',
  'sms_notifications',
  'custom_domain',
  'ai_chatbot',
  'staff_management',
])

export function featureRequiresBilling(feature: FeatureKey): boolean {
  return BILLING_REQUIRED_FEATURES.has(feature)
}

export function hasEntitledFeature(
  tenant: EntitlementTenant,
  billing: BillingRecord | null | undefined,
  feature: FeatureKey
): boolean {
  if (!hasFeature(tenant, feature)) return false
  if (!featureRequiresBilling(feature)) return true
  return hasBillingAccess(billing)
}

export function getEntitlementState(
  tenant: EntitlementTenant,
  billing: BillingRecord | null | undefined,
  feature: FeatureKey
): {
  featureEnabled: boolean
  billingRequired: boolean
  billingAllowed: boolean
  entitled: boolean
} {
  const featureEnabled = hasFeature(tenant, feature)
  const billingRequired = featureRequiresBilling(feature)
  const billingAllowed = billingRequired ? hasBillingAccess(billing) : true

  return {
    featureEnabled,
    billingRequired,
    billingAllowed,
    entitled: featureEnabled && billingAllowed,
  }
}
