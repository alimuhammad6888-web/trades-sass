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
  created_at: string | null
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
    .select(`
      id,
      tenant_id,
      name,
      channel,
      status,
      subject,
      message_body,
      cta_url,
      cta_label
    `)
    .eq('id', campaignId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  if (campaignErr) {
    console.error('[campaigns/send] failed to load campaign:', campaignErr.message)
    return bad('Failed to load campaign.', 500)
  }

  if (!campaign) {
    return bad('Campaign not found.', 404)
  }

  if (campaign.status !== 'draft') {
    return bad('Only draft campaigns can be sent.', 400)
  }

  if (campaign.channel !== 'email') {
    return bad('Only email campaigns are supported in this MVP.', 400)
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
    supabaseAdmin
      .from('customers')
      .select('id, first_name, last_name, email, created_at')
      .eq('tenant_id', auth.tenantId)
      .not('email', 'is', null),
  ])

  if (tenantErr || !tenantRow) {
    console.error('[campaigns/send] failed to load tenant:', tenantErr?.message)
    return bad('Failed to load tenant.', 500)
  }

  if (customerErr) {
    console.error('[campaigns/send] failed to load customers:', customerErr.message)
    return bad('Failed to load customers.', 500)
  }

  const emailCandidates = (customerRows ?? []).filter(
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

  console.log('[campaigns/send] dedupe summary:', {
    totalCustomerRowsConsidered: emailCandidates.length,
    dedupedRecipientCount: dedupedEligibleCustomers.length,
    suppressedByOptOutCount,
  })

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

  for (const customer of dedupedEligibleCustomers) {
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
      status: 'sent',
      sent_at: nowIso,
    })
    .eq('id', campaign.id)
    .eq('tenant_id', auth.tenantId)

  if (campaignUpdateErr) {
    console.error('[campaigns/send] failed to update campaign stats:', campaignUpdateErr.message)
    return bad('Failed to finalize campaign send.', 500)
  }

  return NextResponse.json({
    success: true,
    recipientCount,
    deliveredCount,
    failedCount,
  })
}
