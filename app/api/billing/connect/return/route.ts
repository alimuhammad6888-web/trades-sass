import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_APP_URL is not configured' },
      { status: 500 }
    )
  }

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  const accountId = req.nextUrl.searchParams.get('account')
  const origin = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  const destination = new URL(`${origin}/dashboard/billing`)

  if (!tenantId) {
    destination.searchParams.set('connect', 'error')
    return NextResponse.redirect(destination)
  }

  try {
    const { data: billingRow, error: billingErr } = await supabaseAdmin
      .from('tenant_billing')
      .select('connected_account_id, booking_payments_enabled')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (billingErr) {
      console.error('[billing/connect/return] failed to load tenant billing:', billingErr.message)
      destination.searchParams.set('connect', 'error')
      return NextResponse.redirect(destination)
    }

    const connectedAccountId = billingRow?.connected_account_id ?? accountId

    if (!connectedAccountId) {
      destination.searchParams.set('connect', 'error')
      return NextResponse.redirect(destination)
    }

    const account = await stripe.accounts.retrieve(connectedAccountId)

    const { error: updateErr } = await supabaseAdmin
      .from('tenant_billing')
      .update({
        connected_account_id: account.id,
        stripe_connect_charges_enabled: account.charges_enabled,
        stripe_connect_details_submitted: account.details_submitted,
      })
      .eq('tenant_id', tenantId)

    if (updateErr) {
      console.error('[billing/connect/return] failed to update tenant billing:', updateErr.message)
      destination.searchParams.set('connect', 'error')
      return NextResponse.redirect(destination)
    }

    destination.searchParams.set(
      'connect',
      account.details_submitted ? 'success' : 'incomplete'
    )
    return NextResponse.redirect(destination)
  } catch (err: unknown) {
    console.error('[billing/connect/return] stripe error:', {
      tenantId,
      connectedAccountId: accountId,
      message: err instanceof Error ? err.message : String(err),
    })
    destination.searchParams.set('connect', 'error')
    return NextResponse.redirect(destination)
  }
}
