import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hasEntitledFeature } from '@/lib/entitlements'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { DEFAULT_FEATURES } from '@/lib/tenant'

type ActionBody = {
  tenant_id?: string
  customer_id?: string
  action?: 'mark_resolved' | 'snooze'
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return bad('Unauthorized', 401)
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return bad('Supabase env vars are not configured', 500)
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
    console.error('[inbox/actions] auth error:', authErr?.message)
    return bad('Unauthorized', 401)
  }

  const body = (await req.json().catch(() => null)) as ActionBody | null

  if (!body?.tenant_id || typeof body.tenant_id !== 'string') {
    return bad('tenant_id is required')
  }

  if (!body?.customer_id || typeof body.customer_id !== 'string') {
    return bad('customer_id is required')
  }

  if (!body?.action || !['mark_resolved', 'snooze'].includes(body.action)) {
    return bad('Valid action is required')
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from('users')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .single()

  if (userErr) {
    console.error('[inbox/actions] failed to load user tenant:', userErr.message)
    return bad('Failed to verify tenant', 500)
  }

  if (!userRow?.tenant_id) {
    return bad('Tenant not found', 404)
  }

  const tenantId = userRow.tenant_id

  if (body.tenant_id !== tenantId) {
    return bad('Forbidden', 403)
  }

  const [{ data: tenantData, error: tenantErr }, { data: billingData, error: billingErr }] =
    await Promise.all([
      supabaseAdmin
        .from('tenants')
        .select('id, plan, business_settings(features)')
        .eq('id', tenantId)
        .single(),
      supabaseAdmin
        .from('tenant_billing')
        .select('status, billing_enabled, admin_override, trial_ends_at, current_period_end')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
    ])

  if (tenantErr || !tenantData) {
    console.error('[inbox/actions] failed to load tenant:', tenantErr?.message)
    return bad('Tenant not found', 404)
  }

  if (billingErr) {
    console.error('[inbox/actions] failed to load tenant billing:', billingErr.message)
    return bad('Failed to load billing record', 500)
  }

  const settings = Array.isArray(tenantData.business_settings)
    ? tenantData.business_settings[0]
    : tenantData.business_settings

  const tenant = {
    id: tenantData.id,
    plan: tenantData.plan,
    features: { ...DEFAULT_FEATURES, ...(settings?.features ?? {}) },
  }

  if (!hasEntitledFeature(tenant, billingData ?? null, 'advanced_crm')) {
    return bad('Inbox access is not enabled for this tenant', 403)
  }

  const updatePayload =
    body.action === 'mark_resolved'
      ? {
          inbox_status: 'resolved',
          inbox_last_action_at: new Date().toISOString(),
          inbox_snoozed_until: null,
        }
      : {
          inbox_status: 'waiting_customer',
          inbox_last_action_at: new Date().toISOString(),
        }

  const { data: updatedCustomer, error: updateErr } = await supabaseAdmin
    .from('customers')
    .update(updatePayload)
    .eq('id', body.customer_id)
    .eq('tenant_id', tenantId)
    .select('id')
    .maybeSingle()

  if (updateErr) {
    console.error('[inbox/actions] customer update error:', updateErr.message)
    return bad('Failed to update conversation', 500)
  }

  if (!updatedCustomer) {
    return bad('Customer not found', 404)
  }

  return NextResponse.json({ success: true })
}
