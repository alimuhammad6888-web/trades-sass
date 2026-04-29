import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const VALID_PLANS = new Set(['starter', 'pro', 'enterprise'])

type SmsLimitInput = {
  plan?: string
  monthly_sms_limit?: number
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function isValidMonthlyLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_SECRET) {
    return unauthorized()
  }

  const { data, error } = await supabaseAdmin
    .from('sms_plan_limits')
    .select('id, plan, monthly_sms_limit, created_at, updated_at')
    .order('plan', { ascending: true })

  if (error) {
    console.error('[admin/sms-limits][GET]', error)
    return NextResponse.json({ error: 'Failed to load SMS limits' }, { status: 500 })
  }

  return NextResponse.json({ limits: data ?? [] })
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_SECRET) {
    return unauthorized()
  }

  const body = (await req.json().catch(() => null)) as { limits?: SmsLimitInput[] } | null
  const limits = body?.limits

  if (!Array.isArray(limits) || limits.length === 0) {
    return bad('limits array is required')
  }

  const seenPlans = new Set<string>()

  for (const row of limits) {
    const plan = row?.plan?.trim()

    if (!plan || !VALID_PLANS.has(plan)) {
      return bad('Each limit must have a valid plan')
    }

    if (seenPlans.has(plan)) {
      return bad(`Duplicate plan provided: ${plan}`)
    }

    if (!isValidMonthlyLimit(row.monthly_sms_limit)) {
      return bad(`monthly_sms_limit must be an integer >= 0 for plan ${plan}`)
    }

    seenPlans.add(plan)
  }

  const payload = limits.map(row => ({
    plan: row.plan!.trim(),
    monthly_sms_limit: row.monthly_sms_limit!,
  }))

  const { data, error } = await supabaseAdmin
    .from('sms_plan_limits')
    .upsert(payload, { onConflict: 'plan' })
    .select('id, plan, monthly_sms_limit, created_at, updated_at')

  if (error) {
    console.error('[admin/sms-limits][POST]', error)
    return NextResponse.json({ error: 'Failed to save SMS limits' }, { status: 500 })
  }

  return NextResponse.json({ success: true, limits: data ?? [] })
}
