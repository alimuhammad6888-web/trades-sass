export type BillingStatus = 'trial' | 'active' | 'past_due' | 'suspended'

export type BillingRecord = {
  status: BillingStatus | string | null
  billing_enabled: boolean | null
  admin_override?: boolean | null
  trial_ends_at?: string | null
  current_period_end?: string | null
}

export function hasBillingAccess(billing: BillingRecord | null | undefined): boolean {
  if (!billing) return false
  if (billing.admin_override === true) return true
  return billing.billing_enabled === true
}

export function getCustomerLimit(billing: BillingRecord | null | undefined): number {
  if (hasBillingAccess(billing)) return Number.POSITIVE_INFINITY
  return 5
}

export function canAddCustomer(
  billing: BillingRecord | null | undefined,
  currentCustomerCount: number
): boolean {
  return currentCustomerCount < getCustomerLimit(billing)
}

export function getUpgradeMessage(): string {
  return 'Upgrade to Pro to unlock unlimited customers and premium features.'
}