import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolvePlanName } from '@/lib/features'
import { supabaseAdmin } from '@/lib/supabase-admin'

const OUTBOUND_EVENT_KINDS = [
  'missed_call_auto_reply',
  'owner_notification',
  'quick_reply',
] as const

const INBOUND_EVENT_KINDS = ['inbound_customer_sms'] as const

const DEFAULT_SMS_LIMITS: Record<string, number> = {
  starter: 0,
  pro: 250,
  enterprise: 2000,
}

function getPeriodStart(date = new Date()): string {
  const utcYear = date.getUTCFullYear()
  const utcMonth = date.getUTCMonth()
  return new Date(Date.UTC(utcYear, utcMonth, 1)).toISOString().slice(0, 10)
}

function getNextPeriodStart(periodStart: string): string {
  const [year, month] = periodStart.split('-').map(Number)
  const next = new Date(Date.UTC(year, month, 1))
  return next.toISOString().slice(0, 10)
}

async function getSmsPlanLimit(plan: string | null | undefined): Promise<number> {
  const canonicalPlan = resolvePlanName(plan) ?? 'starter'

  const { data, error } = await supabaseAdmin
    .from('sms_plan_limits')
    .select('monthly_sms_limit')
    .eq('plan', canonicalPlan)
    .maybeSingle()

  if (error) {
    console.error('[billing/sms-usage] failed to load sms plan limit:', error.message)
    return DEFAULT_SMS_LIMITS[canonicalPlan] ?? 0
  }

  return data?.monthly_sms_limit ?? DEFAULT_SMS_LIMITS[canonicalPlan] ?? 0
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Supabase env vars are not configured' }, { status: 500 })
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
    console.error('[billing/sms-usage] auth error:', authErr?.message)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from('users')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .single()

  if (userErr) {
    console.error('[billing/sms-usage] failed to load user tenant:', userErr.message)
    return NextResponse.json({ error: 'Failed to verify tenant' }, { status: 500 })
  }

  if (!userRow?.tenant_id) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const tenantId = userRow.tenant_id

  const { data: tenantRow, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single()

  if (tenantErr) {
    console.error('[billing/sms-usage] failed to load tenant plan:', tenantErr.message)
    return NextResponse.json({ error: 'Failed to load tenant plan' }, { status: 500 })
  }

  const plan = resolvePlanName(tenantRow?.plan) ?? 'starter'
  const periodStart = getPeriodStart()
  const periodEnd = getNextPeriodStart(periodStart)

  const [monthlyLimit, outboundResult, inboundResult] = await Promise.all([
    getSmsPlanLimit(plan),
    supabaseAdmin
      .from('sms_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('direction', 'outbound')
      .in('event_kind', [...OUTBOUND_EVENT_KINDS])
      .gte('created_at', periodStart)
      .lt('created_at', periodEnd),
    supabaseAdmin
      .from('sms_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('direction', 'inbound')
      .in('event_kind', [...INBOUND_EVENT_KINDS])
      .gte('created_at', periodStart)
      .lt('created_at', periodEnd),
  ])

  if (outboundResult.error) {
    console.error('[billing/sms-usage] failed to count outbound usage:', outboundResult.error.message)
    return NextResponse.json({ error: 'Failed to load SMS usage' }, { status: 500 })
  }

  if (inboundResult.error) {
    console.error('[billing/sms-usage] failed to count inbound usage:', inboundResult.error.message)
    return NextResponse.json({ error: 'Failed to load SMS usage' }, { status: 500 })
  }

  const outboundUsed = outboundResult.count ?? 0
  const inboundLogged = inboundResult.count ?? 0
  const remaining = Math.max(monthlyLimit - outboundUsed, 0)
  const percentUsed =
    monthlyLimit <= 0
      ? outboundUsed > 0
        ? 100
        : 0
      : Math.floor((outboundUsed / monthlyLimit) * 100)
  const limitReached = monthlyLimit <= 0 ? outboundUsed > 0 : outboundUsed >= monthlyLimit

  return NextResponse.json({
    plan,
    monthlyLimit,
    outboundUsed,
    inboundLogged,
    remaining,
    percentUsed,
    limitReached,
    periodStart,
  })
}
