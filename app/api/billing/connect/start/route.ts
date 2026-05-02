import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

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
    console.error('[billing/connect/start] auth error:', authErr?.message)
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from('users')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .single()

  if (userErr) {
    console.error('[billing/connect/start] failed to load user tenant:', userErr.message)
    return {
      error: NextResponse.json({ error: 'Failed to verify tenant' }, { status: 500 }),
    }
  }

  if (!userRow?.tenant_id) {
    return { error: NextResponse.json({ error: 'Tenant not found' }, { status: 404 }) }
  }

  return {
    error: null,
    tenantId: userRow.tenant_id as string,
    userId: user.id,
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthedTenant(req)
  if (auth.error) return auth.error

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_APP_URL is not configured' },
      { status: 500 }
    )
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')

  const { data: tenantRow, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', auth.tenantId)
    .maybeSingle()

  if (tenantErr) {
    console.error('[billing/connect/start] failed to load tenant:', tenantErr.message)
    return NextResponse.json({ error: 'Failed to load tenant' }, { status: 500 })
  }

  const { data: billingRow, error: billingErr } = await supabaseAdmin
    .from('tenant_billing')
    .select(
      'connected_account_id, booking_payments_enabled, stripe_connect_charges_enabled, stripe_connect_details_submitted'
    )
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  if (billingErr) {
    console.error('[billing/connect/start] failed to load tenant billing:', billingErr.message)
    return NextResponse.json({ error: 'Failed to load billing record' }, { status: 500 })
  }

  let accountId = billingRow?.connected_account_id ?? null

  try {
    let account

    if (accountId) {
      account = await stripe.accounts.retrieve(accountId)
    } else {
      account = await stripe.accounts.create({
        type: 'express',
        business_type: 'company',
        metadata: {
          tenant_id: auth.tenantId,
        },
        business_profile: tenantRow?.name
          ? {
              name: tenantRow.name,
            }
          : undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })
      accountId = account.id
    }

    const { error: upsertErr } = await supabaseAdmin
      .from('tenant_billing')
      .upsert(
        {
          tenant_id: auth.tenantId,
          connected_account_id: account.id,
          stripe_connect_charges_enabled: account.charges_enabled,
          stripe_connect_details_submitted: account.details_submitted,
          booking_payments_enabled: billingRow?.booking_payments_enabled ?? false,
        },
        { onConflict: 'tenant_id' }
      )

    if (upsertErr) {
      console.error('[billing/connect/start] failed to save connected account:', upsertErr.message)
      return NextResponse.json({ error: 'Failed to save connected account' }, { status: 500 })
    }

    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${origin}/api/billing/connect/refresh?tenant_id=${encodeURIComponent(auth.tenantId)}`,
      return_url: `${origin}/api/billing/connect/return?tenant_id=${encodeURIComponent(auth.tenantId)}&account=${encodeURIComponent(account.id)}`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: link.url })
  } catch (err: unknown) {
    console.error('[billing/connect/start] stripe error:', {
      tenantId: auth.tenantId,
      userId: auth.userId,
      connectedAccountId: accountId,
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start Stripe Connect onboarding' },
      { status: 500 }
    )
  }
}
