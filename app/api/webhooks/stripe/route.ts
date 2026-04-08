import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Stripe from 'stripe'

// Returns null for statuses that should NOT overwrite existing billing state.
// 'incomplete' means payment is still processing — we already set 'active'
// from checkout.session.completed and don't want to regress it.
function mapStatus(stripeStatus: Stripe.Subscription.Status): string | null {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
      return 'suspended'
    case 'incomplete':
      // Payment is still processing — do not overwrite existing status
      return null
    default:
      console.warn('[stripe webhook] unknown subscription status, skipping status write:', stripeStatus)
      return null
  }
}

function getIdFromExpandable(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    typeof (value as { id?: unknown }).id === 'string'
  ) {
    return (value as { id: string }).id
  }
  return null
}

function getUnixField(obj: unknown, key: string): number | null {
  if (!obj || typeof obj !== 'object') return null
  const value = (obj as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : null
}

function toIsoFromUnix(value: number | null): string | null {
  if (typeof value !== 'number') return null
  return new Date(value * 1000).toISOString()
}

function getField(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== 'object') return null
  return (obj as Record<string, unknown>)[key] ?? null
}

function getSubscriptionPeriodEnd(sub: Stripe.Subscription): {
  topLevel: number | null
  itemLevel: number | null
  resolved: number | null
  iso: string | null
} {
  const topLevel = getUnixField(sub, 'current_period_end')

  const firstItem = sub.items?.data?.[0] as Stripe.SubscriptionItem | undefined
  const itemLevel =
    firstItem && typeof firstItem === 'object'
      ? getUnixField(firstItem, 'current_period_end')
      : null

  const resolved = topLevel ?? itemLevel
  const iso = toIsoFromUnix(resolved)

  return { topLevel, itemLevel, resolved, iso }
}

function mapPriceToPlan(priceId: string | null): string | null {
  if (!priceId) return null

  const starter = process.env.STRIPE_PRICE_ID_STARTER
  const pro = process.env.STRIPE_PRICE_ID_PRO
  const enterprise = process.env.STRIPE_PRICE_ID_ENTERPRISE

  if (starter && priceId === starter) return 'starter'
  if (pro && priceId === pro) return 'pro'
  if (enterprise && priceId === enterprise) return 'enterprise'

  console.warn('[stripe webhook] unable to map price to plan:', priceId)
  return null
}

async function updateTenantPlan(tenantId: string, plan: string) {
  const { error } = await supabaseAdmin
    .from('tenants')
    .update({ plan })
    .eq('id', tenantId)

  if (error) {
    console.error('[stripe webhook] tenant plan update error:', {
      tenantId,
      plan,
      message: error.message,
    })
    return
  }

  console.log('[stripe webhook] tenant plan updated:', { tenantId, plan })
}

async function updateBillingByTenantId(
  tenantId: string,
  payload: Record<string, unknown>
) {
  console.log('[stripe webhook] updateBillingByTenantId →', { tenantId, payload })

  const { data, error } = await supabaseAdmin
    .from('tenant_billing')
    .update(payload)
    .eq('tenant_id', tenantId)
    .select('id')

  if (error) {
    console.error('[stripe webhook] DB update error for tenant:', tenantId, '|', error.message)
    return
  }

  if (!data || data.length === 0) {
    console.warn('[stripe webhook] update by tenant_id matched 0 rows:', tenantId)
    return
  }

  console.log('[stripe webhook] updated', data.length, 'row(s) for tenant:', tenantId)
}

async function updateBillingBySubscription(
  subscriptionId: string,
  customerId: string,
  payload: Record<string, unknown>
) {
  const { data, error } = await supabaseAdmin
    .from('tenant_billing')
    .update(payload)
    .eq('stripe_subscription_id', subscriptionId)
    .select('id')

  if (error) {
    console.error('[stripe webhook] DB update error (by subscription_id):', error.message)
    return
  }

  if (data && data.length > 0) {
    console.log('[stripe webhook] updated by subscription_id:', subscriptionId)
    return
  }

  const { data: data2, error: error2 } = await supabaseAdmin
    .from('tenant_billing')
    .update(payload)
    .eq('stripe_customer_id', customerId)
    .select('id')

  if (error2) {
    console.error('[stripe webhook] DB update error (by customer_id):', error2.message)
    return
  }

  if (data2 && data2.length > 0) {
    console.log('[stripe webhook] updated by customer_id:', customerId)
    return
  }

  console.warn('[stripe webhook] no matching row found')
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: unknown) {
    console.error('[stripe webhook] signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log('[stripe webhook] received event:', event.type)

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const tenantId = session.client_reference_id
      const cusId = getIdFromExpandable(session.customer)
      const subId = getIdFromExpandable(session.subscription)

      if (!tenantId) break

      const sessionPlan =
        typeof session.metadata?.plan === 'string' ? session.metadata.plan : null

      await supabaseAdmin
        .from('tenant_billing')
        .upsert(
          {
            tenant_id: tenantId,
            stripe_customer_id: cusId ?? null,
            stripe_subscription_id: subId ?? null,
            status: 'active',
            billing_enabled: true,
          },
          { onConflict: 'tenant_id' }
        )

      if (sessionPlan) {
        await updateTenantPlan(tenantId, sessionPlan)
      }

      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const item = sub.items.data[0]
      const cusId = getIdFromExpandable(sub.customer)
      const tenantId = sub.metadata?.tenant_id ?? null
      const mappedStatus = mapStatus(sub.status)
      const periodInfo = getSubscriptionPeriodEnd(sub)
      const priceId = item?.price?.id ?? null
      const priceMappedPlan = mapPriceToPlan(priceId)
      const metadataPlan =
        typeof sub.metadata?.plan === 'string' ? sub.metadata.plan : null
      const resolvedPlan = metadataPlan ?? priceMappedPlan

      console.log('[stripe webhook] status resolution →', {
        eventType: event.type,
        subscriptionId: sub.id,
        tenantId,
        stripeStatus: sub.status,
        mappedStatus: mappedStatus ?? '(skipped — will not write status)',
        periodEnd: periodInfo.iso,
        priceId,
        resolvedPlan,
      })

      const payload: Record<string, unknown> = {
        stripe_customer_id: cusId,
        stripe_subscription_id: sub.id,
        stripe_price_id: priceId,
        current_period_end: periodInfo.iso,
        cancel_at_period_end: sub.cancel_at_period_end,
      }

      if (mappedStatus !== null) {
        payload.status = mappedStatus
        payload.billing_enabled = mappedStatus === 'active'
      }

      console.log('[stripe webhook] writing payload →', payload)

      if (tenantId) {
        await updateBillingByTenantId(tenantId, payload)
        if (resolvedPlan) {
          await updateTenantPlan(tenantId, resolvedPlan)
        }
      } else if (cusId) {
        await updateBillingBySubscription(sub.id, cusId, payload)
      }

      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const cusId = getIdFromExpandable(sub.customer)
      const tenantId = sub.metadata?.tenant_id ?? null
      const periodInfo = getSubscriptionPeriodEnd(sub)

      const payload = {
        status: 'suspended',
        billing_enabled: false,
        cancel_at_period_end: false,
        current_period_end: periodInfo.iso,
      }

      if (tenantId) {
        await updateBillingByTenantId(tenantId, payload)
      } else if (cusId) {
        await updateBillingBySubscription(sub.id, cusId, payload)
      }

      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subId = getIdFromExpandable(getField(invoice, 'subscription'))
      const cusId = getIdFromExpandable(getField(invoice, 'customer'))

      if (subId && cusId) {
        await updateBillingBySubscription(subId, cusId, { status: 'past_due' })
      }

      break
    }

    default:
      console.log('[stripe webhook] unhandled:', event.type)
  }

  return NextResponse.json({ received: true })
}