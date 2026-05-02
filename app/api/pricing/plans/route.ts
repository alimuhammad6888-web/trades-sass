import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'

type PlanKey = 'starter' | 'pro' | 'enterprise'

type PlanResponse = {
  key: PlanKey
  label: string
  priceLabel: string
  priceId: string | null
}

const PLAN_CONFIG: Array<{ key: PlanKey; label: string; envKey?: string }> = [
  { key: 'starter', label: 'Starter', envKey: 'STRIPE_PRICE_ID_STARTER' },
  { key: 'pro', label: 'Pro', envKey: 'STRIPE_PRICE_ID_PRO' },
  { key: 'enterprise', label: 'Enterprise', envKey: 'STRIPE_PRICE_ID_ENTERPRISE' },
]

function formatPriceLabel(price: Stripe.Price): string {
  if (price.type !== 'recurring' || price.unit_amount == null) {
    return price.currency.toUpperCase()
  }

  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(price.unit_amount / 100)

  const interval = price.recurring.interval
  const intervalCount = price.recurring.interval_count ?? 1

  if (intervalCount > 1) {
    return `${amount}/${intervalCount} ${interval}s`
  }

  const suffix =
    interval === 'month'
      ? 'mo'
      : interval === 'year'
        ? 'yr'
        : interval

  return `${amount}/${suffix}`
}

async function loadPrice(priceId: string): Promise<Stripe.Price | null> {
  try {
    return await stripe.prices.retrieve(priceId)
  } catch (error) {
    console.error('[pricing/plans] failed to load Stripe price:', {
      priceId,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function GET() {
  const plans: PlanResponse[] = []

  for (const config of PLAN_CONFIG) {
    const priceId = config.envKey ? process.env[config.envKey] ?? null : null

    if (!priceId) {
      plans.push({
        key: config.key,
        label: config.label,
        priceLabel: config.key === 'enterprise' ? 'Custom' : config.label,
        priceId: null,
      })
      continue
    }

    const price = await loadPrice(priceId)

    plans.push({
      key: config.key,
      label: config.label,
      priceLabel: price ? formatPriceLabel(price) : config.key === 'enterprise' ? 'Custom' : config.label,
      priceId,
    })
  }

  return NextResponse.json({ plans })
}
