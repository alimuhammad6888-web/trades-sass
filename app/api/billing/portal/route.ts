import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const {
    data: { user },
    error: authErr,
  } = await supabaseUser.auth.getUser(token)

  if (authErr || !user) {
    console.error('[billing/portal] auth error:', authErr?.message)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)

  if (!body?.tenant_id || typeof body.tenant_id !== 'string') {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from('users')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .single()

  if (userErr) {
    console.error('[billing/portal] failed to load user tenant:', userErr.message)
    return NextResponse.json({ error: 'Failed to verify tenant' }, { status: 500 })
  }

  if (!userRow?.tenant_id) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const tenantId = userRow.tenant_id

  if (body.tenant_id !== tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: billingRow, error: billingErr } = await supabaseAdmin
    .from('tenant_billing')
    .select('stripe_customer_id')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (billingErr) {
    console.error('[billing/portal] failed to load tenant billing:', billingErr.message)
    return NextResponse.json({ error: 'Failed to load billing record' }, { status: 500 })
  }

  if (!billingRow?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No Stripe customer found for this tenant' },
      { status: 400 }
    )
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')

  try {
    console.log('[billing/portal] creating billing portal session', {
      tenantId,
      stripeCustomerId: billingRow.stripe_customer_id,
      origin,
      userId: user.id,
    })

    const session = await stripe.billingPortal.sessions.create({
      customer: billingRow.stripe_customer_id,
      return_url: `${origin}/dashboard/billing`,
    })

    if (!session.url) {
      console.error('[billing/portal] session created but no url returned')
      return NextResponse.json({ error: 'No portal URL returned' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('[billing/portal] stripe error full:', err)

    return NextResponse.json(
      {
        error: err?.message || 'Failed to create billing portal session',
        type: err?.type || null,
        code: err?.code || null,
      },
      { status: 500 }
    )
  }
}