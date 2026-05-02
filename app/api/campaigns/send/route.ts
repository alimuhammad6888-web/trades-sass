import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getResend } from '@/src/lib/services'

type SendCampaignBody = {
  campaignId?: string
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

type CampaignRecipientInsert = {
  tenant_id: string
  campaign_id: string
  customer_id: string
  channel: 'email'
  delivery_status: 'pending'
  destination: string
  unsubscribe_token: string
  click_token: string
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function makeToken() {
  return crypto.randomBytes(24).toString('hex')
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatHtmlBody(body: string): string {
  return escapeHtml(body).replace(/\n/g, '<br />')
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') || 'http://localhost:3000'
}

function getDisplayName(customer: EligibleCustomer) {
  return [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || 'there'
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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
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
    return { ok: false, message: 'Invalid campaign audience type.' }
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
    console.error('[campaigns/send] auth error:', authErr?.message)
    return { error: bad('Unauthorized', 401) as NextResponse | null }
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from('users')
    .select('id, tenant_id')
    .eq('auth_user_id', user.id)
    .single()

  if (userErr) {
    console.error('[campaigns/send] failed to load user tenant:', userErr.message)
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

async function markCampaignFailed(params: {
  tenantId: string
  campaignId: string
  reason: string
}) {
  const { error } = await supabaseAdmin
    .from('campaigns')
    .update({ status: 'failed' })
    .eq('id', params.campaignId)
    .eq('tenant_id', params.tenantId)

  if (error) {
    console.error('[campaigns/send] failed to mark campaign failed:', {
      tenantId: params.tenantId,
      campaignId: params.campaignId,
      reason: params.reason,
      error: error.message,
    })
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthedTenant(req)
  if (auth.error) return auth.error

  const payload = (await req.json().catch(() => null)) as SendCampaignBody | null
  const campaignId = payload?.campaignId?.trim()

  if (!campaignId) {
    return bad('campaignId is required.', 400)
  }

  const { data: campaign, error: campaignErr } = await supabaseAdmin
    .from('campaigns')
    .update({
      status: 'sending',
    })
    .eq('id', campaignId)
    .eq('tenant_id', auth.tenantId)
    .eq('status', 'draft')
    .select(`
      id,
      tenant_id,
      name,
      channel,
      status,
      subject,
      message_body,
      cta_url,
      cta_label,
      audience_type,
      audience_filters
    `)
    .maybeSingle()

  if (campaignErr) {
    console.error('[campaigns/send] failed to acquire send lock:', campaignErr.message)
    return bad('Failed to start campaign send.', 500)
  }

  if (!campaign) {
    return bad('Campaign is already sending or has already been sent.', 409)
  }

  if (campaign.channel !== 'email') {
    return bad('Only email campaigns are supported in this MVP.', 400)
  }

  const audience = parseAudience(campaign.audience_type, campaign.audience_filters)
  if (audience.ok === false) {
    return bad(audience.message, 400)
  }

  const [
    { data: tenantRow, error: tenantErr },
    { data: customerRows, error: customerErr },
  ] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select('name, business_settings(email)')
      .eq('id', auth.tenantId)
      .single(),
    resolveAudienceCustomers({
      tenantId: auth.tenantId,
      audienceType: audience.audienceType,
      audienceFilters: audience.audienceFilters,
    }),
  ])

  if (tenantErr || !tenantRow) {
    console.error('[campaigns/send] failed to load tenant:', tenantErr?.message)
    await markCampaignFailed({
      tenantId: auth.tenantId,
      campaignId: campaign.id,
      reason: 'tenant_load_failed',
    })
    return bad('Failed to load tenant.', 500)
  }

  if (customerErr) {
    console.error('[campaigns/send] failed to load customers:', customerErr.message)
    await markCampaignFailed({
      tenantId: auth.tenantId,
      campaignId: campaign.id,
      reason: 'customer_load_failed',
    })
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
      console.error('[campaigns/send] failed to load email opt-outs:', optOutErr.message)
      await markCampaignFailed({
        tenantId: auth.tenantId,
        campaignId: campaign.id,
        reason: 'opt_out_load_failed',
      })
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

  const dedupedEligibleCustomers: EligibleCustomer[] = []
  let suppressedByOptOutCount = 0

  for (const group of Array.from(customersByNormalizedEmail.values())) {
    if (group.some(customer => optedOutIds.has(customer.id))) {
      suppressedByOptOutCount += 1
      continue
    }

    const canonicalCustomer = [...group].sort(compareCustomersForCanonical)[0]
    if (canonicalCustomer) {
      dedupedEligibleCustomers.push(canonicalCustomer)
    }
  }

  console.log('[campaigns/send] audience summary:', {
    audienceType: audience.audienceType,
    baseAudienceCount: baseAudienceCustomers.length,
    totalCustomerRowsConsidered: emailCandidates.length,
    dedupedRecipientCount: dedupedEligibleCustomers.length,
    suppressedByOptOutCount,
  })

  if (dedupedEligibleCustomers.length === 0) {
    return bad('This campaign audience has no eligible email recipients.', 400)
  }

  const recipientInserts: CampaignRecipientInsert[] = dedupedEligibleCustomers.map(customer => ({
    tenant_id: auth.tenantId,
    campaign_id: campaign.id,
    customer_id: customer.id,
    channel: 'email',
    delivery_status: 'pending',
    destination: normalizeEmail(customer.email)!,
    unsubscribe_token: makeToken(),
    click_token: makeToken(),
  }))

  let recipientRows: Array<CampaignRecipientInsert & { id: string }> = []

  if (recipientInserts.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('campaign_recipients')
      .insert(recipientInserts)
      .select('id, tenant_id, campaign_id, customer_id, channel, delivery_status, destination, unsubscribe_token, click_token')

    if (error) {
      console.error('[campaigns/send] failed to create campaign recipients:', error.message)
      await markCampaignFailed({
        tenantId: auth.tenantId,
        campaignId: campaign.id,
        reason: 'recipient_insert_failed',
      })
      return bad('Failed to prepare campaign recipients.', 500)
    }

    recipientRows = (data ?? []) as Array<CampaignRecipientInsert & { id: string }>
  }

  const recipientByCustomerId = new Map(recipientRows.map(row => [row.customer_id, row]))
  const settings = Array.isArray(tenantRow.business_settings)
    ? tenantRow.business_settings[0]
    : tenantRow.business_settings
  const resend = getResend()
  const fromEmail = process.env.EMAIL_FROM ?? 'noreply@yourdomain.com'
  const replyTo = settings?.email ?? undefined
  const baseUrl = getBaseUrl()
  const batchSize = 5
  const batchDelayMs = 1000
  const deliveredRecipientIds: string[] = []
  const failedRecipientIds: string[] = []
  const eventRows: Array<{
    tenant_id: string
    campaign_id: string
    campaign_recipient_id: string
    customer_id: string
    event_type: 'sent' | 'failed'
    event_metadata: Record<string, string>
  }> = []

  const numberOfBatches = Math.ceil(dedupedEligibleCustomers.length / batchSize)

  console.log('[campaigns/send] throttling summary:', {
    recipientCount: dedupedEligibleCustomers.length,
    batchSize,
    numberOfBatches,
  })

  for (let batchStart = 0; batchStart < dedupedEligibleCustomers.length; batchStart += batchSize) {
    const batchIndex = Math.floor(batchStart / batchSize) + 1
    const batchCustomers = dedupedEligibleCustomers.slice(batchStart, batchStart + batchSize)

    console.log('[campaigns/send] sending batch:', {
      batchIndex,
      numberOfBatches,
      batchSize: batchCustomers.length,
    })

    for (const customer of batchCustomers) {
      const recipient = recipientByCustomerId.get(customer.id)
      if (!recipient) continue

      const unsubscribeUrl = `${baseUrl}/api/campaigns/unsubscribe?token=${recipient.unsubscribe_token}`
      const trackedCtaUrl =
        campaign.cta_url && campaign.cta_url.trim()
          ? `${baseUrl}/api/campaigns/click?token=${recipient.click_token}`
          : null

      const customerName = getDisplayName(customer)
      const htmlParts = [
        '<div style="font-family:sans-serif;line-height:1.6;color:#1a1917;">',
        `<p>Hi ${escapeHtml(customerName)},</p>`,
        `<div>${formatHtmlBody(campaign.message_body)}</div>`,
      ]

      if (trackedCtaUrl) {
        const ctaLabel = escapeHtml(campaign.cta_label?.trim() || 'Learn more')
        htmlParts.push(
          `<p style="margin:24px 0;">` +
            `<a href="${escapeHtml(trackedCtaUrl)}" ` +
            'style="display:inline-block;padding:12px 18px;border-radius:6px;background:#1a1917;color:#ffffff;text-decoration:none;font-weight:700;">' +
            `${ctaLabel}</a></p>`
        )
      }

      htmlParts.push(
        `<p style="margin-top:24px;">— ${escapeHtml(tenantRow.name)}</p>`,
        `<p style="margin-top:24px;font-size:12px;color:#666666;">` +
          `To stop receiving campaign emails, <a href="${escapeHtml(unsubscribeUrl)}">unsubscribe here</a>.` +
        '</p>',
        '</div>'
      )

      const textParts = [
        `Hi ${customerName},`,
        '',
        campaign.message_body,
      ]

      if (trackedCtaUrl) {
        textParts.push('', `${campaign.cta_label?.trim() || 'Learn more'}: ${trackedCtaUrl}`)
      }

      textParts.push(
        '',
        `— ${tenantRow.name}`,
        '',
        `Unsubscribe: ${unsubscribeUrl}`
      )

      try {
        const resendResult = await resend.emails.send({
          from: fromEmail,
          to: normalizeEmail(customer.email)!,
          subject: campaign.subject,
          text: textParts.join('\n'),
          html: htmlParts.join(''),
          reply_to: replyTo,
        } as any)

        const resendError = (resendResult as any)?.error

        if (resendError) {
          failedRecipientIds.push(recipient.id)
          eventRows.push({
            tenant_id: auth.tenantId,
            campaign_id: campaign.id,
            campaign_recipient_id: recipient.id,
            customer_id: customer.id,
            event_type: 'failed',
            event_metadata: {
              reason: resendError.message ?? 'resend_error',
            },
          })
          continue
        }

        deliveredRecipientIds.push(recipient.id)
        eventRows.push({
          tenant_id: auth.tenantId,
          campaign_id: campaign.id,
          campaign_recipient_id: recipient.id,
          customer_id: customer.id,
          event_type: 'sent',
          event_metadata: {
            provider_message_id: String((resendResult as any)?.id ?? ''),
          },
        })
      } catch (error) {
        console.error('[campaigns/send] resend send failed for recipient:', {
          tenantId: auth.tenantId,
          campaignId: campaign.id,
          customerId: customer.id,
          error: error instanceof Error ? error.message : String(error),
        })

        failedRecipientIds.push(recipient.id)
        eventRows.push({
          tenant_id: auth.tenantId,
          campaign_id: campaign.id,
          campaign_recipient_id: recipient.id,
          customer_id: customer.id,
          event_type: 'failed',
          event_metadata: {
            reason: error instanceof Error ? error.message : 'unknown_error',
          },
        })
      }
    }

    if (batchIndex < numberOfBatches) {
      await sleep(batchDelayMs)
    }
  }

  const nowIso = new Date().toISOString()

  if (deliveredRecipientIds.length > 0) {
    const sentRecipientIds = Array.from(new Set(deliveredRecipientIds))
    const sentProviderIds = new Map(
      eventRows
        .filter(row => row.event_type === 'sent')
        .map(row => [row.campaign_recipient_id, row.event_metadata.provider_message_id || null])
    )

    for (const recipientId of sentRecipientIds) {
      const { error } = await supabaseAdmin
        .from('campaign_recipients')
        .update({
          delivery_status: 'sent',
          sent_at: nowIso,
          provider_message_id: sentProviderIds.get(recipientId),
        })
        .eq('id', recipientId)
        .eq('tenant_id', auth.tenantId)

      if (error) {
        console.error('[campaigns/send] failed to mark recipient sent:', error.message)
      }
    }
  }

  if (failedRecipientIds.length > 0) {
    const uniqueFailedRecipientIds = Array.from(new Set(failedRecipientIds))
    const failureReasons = new Map(
      eventRows
        .filter(row => row.event_type === 'failed')
        .map(row => [row.campaign_recipient_id, row.event_metadata.reason || 'send_failed'])
    )

    for (const recipientId of uniqueFailedRecipientIds) {
      const { error } = await supabaseAdmin
        .from('campaign_recipients')
        .update({
          delivery_status: 'failed',
          failed_at: nowIso,
          failure_reason: failureReasons.get(recipientId),
        })
        .eq('id', recipientId)
        .eq('tenant_id', auth.tenantId)

      if (error) {
        console.error('[campaigns/send] failed to mark recipient failed:', error.message)
      }
    }
  }

  if (eventRows.length > 0) {
    const { error: eventErr } = await supabaseAdmin
      .from('campaign_events')
      .insert(eventRows)

    if (eventErr) {
      console.error('[campaigns/send] failed to insert campaign events:', eventErr.message)
      await markCampaignFailed({
        tenantId: auth.tenantId,
        campaignId: campaign.id,
        reason: 'event_insert_failed',
      })
      return bad('Failed to record campaign send events.', 500)
    }
  }

  const deliveredCount = deliveredRecipientIds.length
  const failedCount = failedRecipientIds.length
  const recipientCount = recipientInserts.length

  const { error: campaignUpdateErr } = await supabaseAdmin
    .from('campaigns')
    .update({
      recipient_count: recipientCount,
      delivered_count: deliveredCount,
      failed_count: failedCount,
      status: deliveredCount > 0 ? 'sent' : 'failed',
      sent_at: nowIso,
    })
    .eq('id', campaign.id)
    .eq('tenant_id', auth.tenantId)

  if (campaignUpdateErr) {
    console.error('[campaigns/send] failed to update campaign stats:', campaignUpdateErr.message)
    await markCampaignFailed({
      tenantId: auth.tenantId,
      campaignId: campaign.id,
      reason: 'campaign_finalize_failed',
    })
    return bad('Failed to finalize campaign send.', 500)
  }

  return NextResponse.json({
    success: true,
    recipientCount,
    deliveredCount,
    failedCount,
  })
}
