import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hasFeature } from '@/lib/features'

type ToggleBody = {
  enabled?: boolean
}

async function getAuthedTenant(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      error: NextResponse.json(
        { error: 'Supabase env vars are not configured' },
        { status: 500 }
      ),
    }
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
    console.error('[billing/connect/toggle] auth error:', authErr?.message)
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from('users')
    .select('tenant_id, tenants(plan)')
    .eq('auth_user_id', user.id)
    .single()

  if (userErr) {
    console.error('[billing/connect/toggle] failed to load user tenant:', userErr.message)
    return {
      error: NextResponse.json({ error: 'Failed to verify tenant' }, { status: 500 }),
    }
  }

  if (!userRow?.tenant_id) {
    return { error: NextResponse.json({ error: 'Tenant not found' }, { status: 404 }) }
  }

  const tenantPlan =
    userRow.tenants && typeof userRow.tenants === 'object' && 'plan' in userRow.tenants
      ? String(userRow.tenants.plan ?? '')
      : null

  return {
    error: null,
    tenantId: userRow.tenant_id as string,
    tenantPlan,
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthedTenant(req)
  if (auth.error) return auth.error

  const body = (await req.json().catch(() => null)) as ToggleBody | null

  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled is required' }, { status: 400 })
  }

  if (body.enabled && !hasFeature({ plan: auth.tenantPlan }, 'payments')) {
    return NextResponse.json(
      { error: 'Your current plan does not support booking payments.' },
      { status: 403 }
    )
  }

  const { data: billingRow, error: billingErr } = await supabaseAdmin
    .from('tenant_billing')
    .select(
      'connected_account_id, booking_payments_enabled, stripe_connect_charges_enabled, stripe_connect_details_submitted'
    )
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  if (billingErr) {
    console.error('[billing/connect/toggle] failed to load tenant billing:', billingErr.message)
    return NextResponse.json({ error: 'Failed to load billing record' }, { status: 500 })
  }

  if (!billingRow) {
    return NextResponse.json({ error: 'Billing record not found' }, { status: 404 })
  }

  if (body.enabled) {
    if (!billingRow.connected_account_id) {
      return NextResponse.json(
        { error: 'Connect Stripe before enabling booking payments.' },
        { status: 400 }
      )
    }

    if (!billingRow.stripe_connect_details_submitted) {
      return NextResponse.json(
        { error: 'Complete Stripe onboarding before enabling booking payments.' },
        { status: 400 }
      )
    }

    if (!billingRow.stripe_connect_charges_enabled) {
      return NextResponse.json(
        { error: 'Stripe account charges are not enabled yet.' },
        { status: 400 }
      )
    }
  }

  const { error: updateErr } = await supabaseAdmin
    .from('tenant_billing')
    .update({
      booking_payments_enabled: body.enabled,
    })
    .eq('tenant_id', auth.tenantId)

  if (updateErr) {
    console.error('[billing/connect/toggle] failed to update booking payments setting:', updateErr.message)
    return NextResponse.json(
      { error: 'Failed to update booking payments setting.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    booking_payments_enabled: body.enabled,
  })
}
