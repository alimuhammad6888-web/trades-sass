import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

type CreateCampaignBody = {
  name?: string
  channel?: string
  subject?: string
  message_body?: string
  cta_url?: string
  cta_label?: string
  audience_type?: string
  audience_filters?: Record<string, unknown> | null
}

const VALID_AUDIENCE_TYPES = new Set([
  'all_eligible',
  'has_email',
  'has_phone',
  'booked_within',
  'not_booked_since',
  'created_within',
])

function isValidDateOnly(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function validateAudience(
  audienceType: string,
  audienceFilters: Record<string, unknown> | null
): { ok: true; audienceFilters: Record<string, unknown> } | { ok: false; message: string } {
  if (!VALID_AUDIENCE_TYPES.has(audienceType)) {
    return { ok: false, message: 'Invalid audience type.' }
  }

  const safeFilters = audienceFilters && typeof audienceFilters === 'object' ? audienceFilters : {}
  const startDate = safeFilters['startDate']
  const endDate = safeFilters['endDate']
  const sinceDate = safeFilters['sinceDate']

  if (audienceType === 'all_eligible' || audienceType === 'has_email' || audienceType === 'has_phone') {
    if (startDate !== undefined || endDate !== undefined || sinceDate !== undefined) {
      return { ok: false, message: `No date filters are allowed for ${audienceType}.` }
    }

    return { ok: true, audienceFilters: { type: audienceType } }
  }

  if (audienceType === 'booked_within' || audienceType === 'created_within') {
    if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) {
      return { ok: false, message: `${audienceType} requires startDate and endDate.` }
    }

    return {
      ok: true,
      audienceFilters: {
        type: audienceType,
        startDate,
        endDate,
      },
    }
  }

  if (audienceType === 'not_booked_since') {
    if (!isValidDateOnly(sinceDate)) {
      return { ok: false, message: 'not_booked_since requires sinceDate.' }
    }

    return {
      ok: true,
      audienceFilters: {
        type: audienceType,
        sinceDate,
      },
    }
  }

  return { ok: false, message: 'Invalid audience configuration.' }
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
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
    console.error('[campaigns] auth error:', authErr?.message)
    return { error: bad('Unauthorized', 401) as NextResponse | null }
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from('users')
    .select('id, tenant_id')
    .eq('auth_user_id', user.id)
    .single()

  if (userErr) {
    console.error('[campaigns] failed to load user tenant:', userErr.message)
    return { error: bad('Failed to verify tenant', 500) as NextResponse | null }
  }

  if (!userRow?.tenant_id) {
    return { error: bad('Tenant not found', 404) as NextResponse | null }
  }

  return {
    error: null,
    tenantId: userRow.tenant_id as string,
    userId: (userRow.id as string | null) ?? null,
  }
}

export async function GET(req: NextRequest) {
  const auth = await getAuthedTenant(req)
  if (auth.error) return auth.error

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select(`
      id,
      name,
      channel,
      status,
      subject,
      message_body,
      cta_url,
      cta_label,
      audience_type,
      audience_filters,
      recipient_count,
      delivered_count,
      clicked_count,
      failed_count,
      created_at,
      sent_at
    `)
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[campaigns][GET] failed to load campaigns:', error.message)
    return bad('Failed to load campaigns', 500)
  }

  return NextResponse.json({ campaigns: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await getAuthedTenant(req)
  if (auth.error) return auth.error

  const payload = (await req.json().catch(() => null)) as CreateCampaignBody | null

  const name = payload?.name?.trim()
  const channel = payload?.channel?.trim()
  const subject = payload?.subject?.trim()
  const messageBody = payload?.message_body?.trim()
  const ctaUrl = payload?.cta_url?.trim() || null
  const ctaLabel = payload?.cta_label?.trim() || null
  const audienceType = payload?.audience_type?.trim() || 'all_eligible'
  const audienceFiltersInput =
    payload?.audience_filters && typeof payload.audience_filters === 'object'
      ? payload.audience_filters
      : null

  if (!name) return bad('Campaign name is required.', 400)
  if (channel !== 'email') return bad('Only email campaigns are available in this MVP.', 400)
  if (!subject) return bad('Email subject is required.', 400)
  if (!messageBody) return bad('Message body is required.', 400)

  const validatedAudience = validateAudience(audienceType, audienceFiltersInput)
  if (validatedAudience.ok === false) {
    return bad(validatedAudience.message, 400)
  }

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .insert({
      tenant_id: auth.tenantId,
      title: name,
      body: messageBody,
      email_subject: subject,
      channels: ['email'],
      name,
      channel: 'email',
      status: 'draft',
      subject,
      message_body: messageBody,
      audience_type: audienceType,
      audience_filters: validatedAudience.audienceFilters,
      cta_url: ctaUrl,
      cta_label: ctaLabel,
      created_by_user_id: auth.userId,
    })
    .select(`
      id,
      name,
      channel,
      status,
      subject,
      message_body,
      cta_url,
      cta_label,
      audience_type,
      audience_filters,
      recipient_count,
      delivered_count,
      clicked_count,
      failed_count,
      created_at,
      sent_at
    `)
    .single()

  if (error || !data) {
    console.error('[campaigns][POST] failed to create campaign:', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    })
    return bad('Failed to create campaign draft.', 500)
  }

  return NextResponse.json({ campaign: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthedTenant(req)
  if (auth.error) return auth.error

  const payload = (await req.json().catch(() => null)) as { campaignId?: string } | null
  const campaignId = payload?.campaignId?.trim()

  if (!campaignId) {
    return bad('campaignId is required.', 400)
  }

  const { data: campaign, error: campaignErr } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  if (campaignErr) {
    console.error('[campaigns][DELETE] failed to load campaign:', campaignErr.message)
    return bad('Failed to load campaign.', 500)
  }

  if (!campaign) {
    return bad('Campaign not found.', 404)
  }

  const { error } = await supabaseAdmin
    .from('campaigns')
    .delete()
    .eq('id', campaignId)
    .eq('tenant_id', auth.tenantId)

  if (error) {
    console.error('[campaigns][DELETE] failed to delete campaign:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    return bad('Failed to delete campaign.', 500)
  }

  return NextResponse.json({ success: true })
}
