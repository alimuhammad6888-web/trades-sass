import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

const VALID_PLANS = ['starter', 'pro', 'enterprise'] as const
type Plan = typeof VALID_PLANS[number]

const PLAN_PRICE_ENV: Record<Plan, string> = {
  starter:    'STRIPE_PRICE_ID_STARTER',
  pro:        'STRIPE_PRICE_ID_PRO',
  enterprise: 'STRIPE_PRICE_ID_ENTERPRISE',
}

function getPriceId(plan: Plan): string | undefined {
  return process.env[PLAN_PRICE_ENV[plan]]
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Supabase env vars are not configured' }, { status: 500 })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY is not configured' }, { status: 500 })
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not configured' }, { status: 500 })
  }

  // Verify Supabase session
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser(token)

  if (authErr || !user) {
    console.error('[billing/checkout] auth error:', authErr?.message)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse and validate body
  const body = await req.json().catch(() => null)

  if (!body?.tenant_id || typeof body.tenant_id !== 'string') {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }

  if (!body?.plan || typeof body.plan !== 'string') {
    return NextResponse.json({ error: 'plan is required' }, { status: 400 })
  }

  if (!VALID_PLANS.includes(body.plan as Plan)) {
    return NextResponse.json(
      { error: `plan must be one of: ${VALID_PLANS.join(', ')}` },
      { status: 400 }
    )
  }

  const plan = body.plan as Plan

  // Resolve price ID for the selected plan
  const priceId = getPriceId(plan)

  if (!priceId) {
    console.error(`[billing/checkout] env var ${PLAN_PRICE_ENV[plan]} is not set`)
    return NextResponse.json(
      { error: `Stripe price not configured for plan: ${plan}` },
      { status: 500 }
    )
  }

  // Verify tenant ownership
  const { data: userRow, error: userErr } = await supabaseAdmin
    .from('users')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .single()

  if (userErr) {
    console.error('[billing/checkout] failed to load user tenant:', userErr.message)
    return NextResponse.json({ error: 'Failed to verify tenant' }, { status: 500 })
  }

  if (!userRow?.tenant_id) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const tenantId = userRow.tenant_id

  if (body.tenant_id !== tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')

  try {
    console.log('[billing/checkout] creating checkout session', {
      tenantId,
      plan,
      priceId,
      origin,
      userId: user.id,
    })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: tenantId,
      line_items: [
        {
          price:    priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          tenant_id: tenantId,
          plan,
        },
      },
      success_url: `${origin}/dashboard/billing?checkout=success`,
      cancel_url:  `${origin}/dashboard/billing?checkout=cancel`,
    })

    if (!session.url) {
      console.error('[billing/checkout] session created but no url returned', {
        sessionId: session.id,
      })
      return NextResponse.json({ error: 'No checkout URL returned' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })

  } catch (err: any) {
    console.error('[billing/checkout] stripe error full:', err)
    return NextResponse.json(
      {
        error: err?.message || 'Failed to create checkout session',
        type:  err?.type   || null,
        code:  err?.code   || null,
      },
      { status: 500 }
    )
  }
}