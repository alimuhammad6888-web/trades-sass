import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

type AudiencePreviewBody = {
  audience_type?: string
  audience_filters?: Record<string, unknown> | null
  channel?: string
}

type EligibleCustomer = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  created_at: string | null
}

type AudienceType =
  | 'all_eligible'
  | 'has_email'
  | 'has_phone'
  | 'booked_within'
  | 'not_booked_since'
  | 'created_within'

type AudienceFilters = {
  type?: AudienceType
  startDate?: string
  endDate?: string
  sinceDate?: string
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function normalizeEmail(email: string | null | undefined) {
  const trimmed = email?.trim()
  if (!trimmed) return null
  return trimmed.toLowerCase()
}

function compareCustomersForCanonical(a: EligibleCustomer, b: EligibleCustomer) {
  const aTime = a.created_at ? Date.parse(a.created_at) : Number.NaN
  const bTime = b.created_at ? Date.parse(b.created_at) : Number.NaN
  const aHasTime = Number.isFinite(aTime)
  const bHasTime = Number.isFinite(bTime)

  if (aHasTime && bHasTime && aTime !== bTime) {
    return aTime - bTime
  }

  if (aHasTime !== bHasTime) {
    return aHasTime ? -1 : 1
  }

  return a.id.localeCompare(b.id)
}

function isDateOnly(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function startOfDateUtc(value: string) {
  return `${value}T00:00:00.000Z`
}

function nextDateUtc(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}

function parseAudience(
  audienceType: unknown,
  audienceFilters: unknown
): { ok: true; audienceType: AudienceType; audienceFilters: AudienceFilters } | { ok: false; message: string } {
  if (
    audienceType !== 'all_eligible' &&
    audienceType !== 'has_email' &&
    audienceType !== 'has_phone' &&
    audienceType !== 'booked_within' &&
    audienceType !== 'not_booked_since' &&
    audienceType !== 'created_within'
  ) {
    return { ok: false, message: 'Invalid audience type.' }
  }

  const filters = audienceFilters && typeof audienceFilters === 'object'
    ? (audienceFilters as AudienceFilters)
    : {}

  if (audienceType === 'all_eligible' || audienceType === 'has_email' || audienceType === 'has_phone') {
    return {
      ok: true,
      audienceType,
      audienceFilters: { type: audienceType },
    }
  }

  if (audienceType === 'booked_within' || audienceType === 'created_within') {
    if (!isDateOnly(filters.startDate) || !isDateOnly(filters.endDate)) {
      return { ok: false, message: `${audienceType} requires startDate and endDate.` }
    }

    return {
      ok: true,
      audienceType,
      audienceFilters: {
        type: audienceType,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    }
  }

  if (!isDateOnly(filters.sinceDate)) {
    return { ok: false, message: 'not_booked_since requires sinceDate.' }
  }

  return {
    ok: true,
    audienceType,
    audienceFilters: {
      type: audienceType,
      sinceDate: filters.sinceDate,
    },
  }
}

async function resolveAudienceCustomers(params: {
  tenantId: string
  audienceType: AudienceType
  audienceFilters: AudienceFilters
}) {
  const baseQuery = supabaseAdmin
    .from('customers')
    .select('id, first_name, last_name, email, phone, created_at')
    .eq('tenant_id', params.tenantId)

  if (params.audienceType === 'all_eligible') {
    return baseQuery
  }

  if (params.audienceType === 'has_email') {
    return baseQuery.not('email', 'is', null)
  }

  if (params.audienceType === 'has_phone') {
    return baseQuery.not('phone', 'is', null)
  }

  if (params.audienceType === 'created_within') {
    return baseQuery
      .gte('created_at', startOfDateUtc(params.audienceFilters.startDate!))
      .lt('created_at', nextDateUtc(params.audienceFilters.endDate!))
  }

  if (params.audienceType === 'booked_within') {
    const { data: bookingRows, error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .select('customer_id')
      .eq('tenant_id', params.tenantId)
      .gte('starts_at', startOfDateUtc(params.audienceFilters.startDate!))
      .lt('starts_at', nextDateUtc(params.audienceFilters.endDate!))
      .not('customer_id', 'is', null)

    if (bookingErr) {
      return { data: null, error: bookingErr }
    }

    const customerIds = Array.from(
      new Set((bookingRows ?? []).map(row => row.customer_id).filter((value): value is string => typeof value === 'string' && value.length > 0))
    )

    if (customerIds.length === 0) {
      return { data: [], error: null }
    }

    return baseQuery.in('id', customerIds)
  }

  const { data: recentBookingRows, error: recentBookingErr } = await supabaseAdmin
    .from('bookings')
    .select('customer_id')
    .eq('tenant_id', params.tenantId)
    .gte('starts_at', startOfDateUtc(params.audienceFilters.sinceDate!))
    .not('customer_id', 'is', null)

  if (recentBookingErr) {
    return { data: null, error: recentBookingErr }
  }

  const excludedIds = Array.from(
    new Set((recentBookingRows ?? []).map(row => row.customer_id).filter((value): value is string => typeof value === 'string' && value.length > 0))
  )

  if (excludedIds.length === 0) {
    return baseQuery
  }

  const { data: customers, error: customerErr } = await baseQuery

  if (customerErr) {
    return { data: null, error: customerErr }
  }

  const excludedIdSet = new Set(excludedIds)
  return {
    data: (customers ?? []).filter(row => !excludedIdSet.has(row.id)),
    error: null,
  }
}

async function getAuthedTenant(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return { error: bad('Unauthorized', 401) as NextResponse | null }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { error: bad('Supabase env vars are not configured', 500) as NextResponse | null }
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
    console.error('[campaigns/audience-preview] auth error:', authErr?.message)
    return { error: bad('Unauthorized', 401) as NextResponse | null }
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from('users')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .single()

  if (userErr) {
    console.error('[campaigns/audience-preview] failed to load user tenant:', userErr.message)
    return { error: bad('Failed to verify tenant', 500) as NextResponse | null }
  }

  if (!userRow?.tenant_id) {
    return { error: bad('Tenant not found', 404) as NextResponse | null }
  }

  return {
    error: null,
    tenantId: userRow.tenant_id as string,
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthedTenant(req)
  if (auth.error) return auth.error

  const payload = (await req.json().catch(() => null)) as AudiencePreviewBody | null
  const channel = payload?.channel?.trim()

  if (channel !== 'email') {
    return bad('Only email audience preview is supported in this MVP.', 400)
  }

  const audience = parseAudience(payload?.audience_type, payload?.audience_filters)
  if (audience.ok === false) {
    return bad(audience.message, 400)
  }

  const { data: customerRows, error: customerErr } = await resolveAudienceCustomers({
    tenantId: auth.tenantId,
    audienceType: audience.audienceType,
    audienceFilters: audience.audienceFilters,
  })

  if (customerErr) {
    console.error('[campaigns/audience-preview] failed to load customers:', customerErr.message)
    return bad('Failed to load customers.', 500)
  }

  const baseAudienceCustomers = (customerRows ?? []) as EligibleCustomer[]
  const emailCandidates = baseAudienceCustomers.filter(
    (row): row is EligibleCustomer => typeof row.email === 'string' && row.email.trim().length > 0
  )

  const candidateIds = emailCandidates.map(row => row.id)
  let optedOutIds = new Set<string>()

  if (candidateIds.length > 0) {
    const { data: optOutRows, error: optOutErr } = await supabaseAdmin
      .from('customer_channel_opt_outs')
      .select('customer_id')
      .eq('tenant_id', auth.tenantId)
      .eq('channel', 'email')
      .in('customer_id', candidateIds)

    if (optOutErr) {
      console.error('[campaigns/audience-preview] failed to load email opt-outs:', optOutErr.message)
      return bad('Failed to load customer opt-outs.', 500)
    }

    optedOutIds = new Set((optOutRows ?? []).map(row => row.customer_id))
  }

  const customersByNormalizedEmail = new Map<string, EligibleCustomer[]>()

  for (const customer of emailCandidates) {
    const normalizedEmail = normalizeEmail(customer.email)
    if (!normalizedEmail) continue

    const existingGroup = customersByNormalizedEmail.get(normalizedEmail)
    if (existingGroup) {
      existingGroup.push(customer)
    } else {
      customersByNormalizedEmail.set(normalizedEmail, [customer])
    }
  }

  let suppressedByOptOutCount = 0
  let dedupedRecipientCount = 0

  for (const group of Array.from(customersByNormalizedEmail.values())) {
    if (group.some(customer => optedOutIds.has(customer.id))) {
      suppressedByOptOutCount += 1
      continue
    }

    const canonicalCustomer = [...group].sort(compareCustomersForCanonical)[0]
    if (canonicalCustomer) {
      dedupedRecipientCount += 1
    }
  }

  console.log('[campaigns/audience-preview] summary:', {
    audienceType: audience.audienceType,
    baseAudienceCount: baseAudienceCustomers.length,
    emailCandidateCount: emailCandidates.length,
    dedupedRecipientCount,
    suppressedByOptOutCount,
  })

  return NextResponse.json({
    success: true,
    baseAudienceCount: baseAudienceCustomers.length,
    emailCandidateCount: emailCandidates.length,
    dedupedRecipientCount,
    suppressedByOptOutCount,
  })
}
