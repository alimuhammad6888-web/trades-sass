import { NextRequest, NextResponse } from 'next/server'
import { hasEntitledFeature } from '@/lib/entitlements'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { DEFAULT_FEATURES } from '@/lib/tenant'
import { getTwilio } from '@/src/lib/services'
import { canSendOutboundSms, recordOutboundAndMaybeWarn } from '@/src/lib/sms-limits'

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  if (!digits) return null
  if (hasPlus) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

async function loadTokenContext(token: string) {
  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from('quick_reply_tokens')
    .select('id, tenant_id, customer_id, thread_id, expires_at, used_at, token')
    .eq('token', token)
    .maybeSingle()

  if (tokenErr) {
    console.error('[reply/token] token lookup failed:', tokenErr.message)
    return { error: 'lookup_failed' as const }
  }

  if (!tokenRow) {
    return { error: 'not_found' as const }
  }

  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    return { error: 'expired' as const }
  }

  const [
    { data: tenantData, error: tenantErr },
    { data: billingData, error: billingErr },
    { data: businessSettings, error: settingsErr },
    { data: customer, error: customerErr },
  ] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select('id, name, plan, business_settings(features)')
      .eq('id', tokenRow.tenant_id)
      .single(),
    supabaseAdmin
      .from('tenant_billing')
      .select('status, billing_enabled, admin_override, trial_ends_at, current_period_end')
      .eq('tenant_id', tokenRow.tenant_id)
      .maybeSingle(),
    supabaseAdmin
      .from('business_settings')
      .select('phone, notification_phone')
      .eq('tenant_id', tokenRow.tenant_id)
      .single(),
    supabaseAdmin
      .from('customers')
      .select('id, phone')
      .eq('id', tokenRow.customer_id)
      .eq('tenant_id', tokenRow.tenant_id)
      .single(),
  ])

  if (tenantErr || !tenantData) {
    console.error('[reply/token] tenant lookup failed:', tenantErr?.message)
    return { error: 'tenant_not_found' as const }
  }

  if (billingErr) {
    console.error('[reply/token] billing lookup failed:', billingErr.message)
    return { error: 'billing_lookup_failed' as const }
  }

  if (settingsErr || !businessSettings) {
    console.error('[reply/token] business settings lookup failed:', settingsErr?.message)
    return { error: 'settings_not_found' as const }
  }

  if (customerErr || !customer) {
    console.error('[reply/token] customer lookup failed:', customerErr?.message)
    return { error: 'customer_not_found' as const }
  }

  const featureSettings = Array.isArray(tenantData.business_settings)
    ? tenantData.business_settings[0]
    : tenantData.business_settings

  const tenant = {
    id: tenantData.id,
    plan: tenantData.plan,
    features: { ...DEFAULT_FEATURES, ...(featureSettings?.features ?? {}) },
  }

  return {
    error: null,
    tokenRow,
    tenantData,
    tenant,
    billing: billingData ?? null,
    businessSettings,
    customer,
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: { token: string } }
) {
  const { token } = context.params
  const resolved = await loadTokenContext(token)

  if (resolved.error === 'not_found') return bad('Reply link not found.', 404)
  if (resolved.error === 'expired') return bad('Reply link has expired.', 410)
  if (resolved.error) return bad('Failed to load reply link.', 500)

  if (!hasEntitledFeature(resolved.tenant, resolved.billing, 'advanced_crm')) {
    return bad('Reply link is not enabled for this tenant.', 403)
  }

  const threadId = resolved.tokenRow.thread_id

  let messages: any[] = []

  if (threadId) {
    const { data: messageRows, error: messageErr } = await supabaseAdmin
      .from('inbox_messages')
      .select('id, direction, body, created_at')
      .eq('tenant_id', resolved.tokenRow.tenant_id)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(20)

    if (messageErr) {
      console.error('[reply/token] message lookup failed:', messageErr.message)
      return bad('Failed to load message history.', 500)
    }

    messages = messageRows ?? []
  }

  return NextResponse.json({
    tenantName: resolved.tenantData.name,
    customerPhone: resolved.customer.phone,
    replyFromPhone: resolved.businessSettings.phone,
    threadId: resolved.tokenRow.thread_id,
    messages,
  })
}

export async function POST(
  req: NextRequest,
  context: { params: { token: string } }
) {
  const { token } = context.params
  const resolved = await loadTokenContext(token)

  if (resolved.error === 'not_found') return bad('Reply link not found.', 404)
  if (resolved.error === 'expired') return bad('Reply link has expired.', 410)
  if (resolved.error) return bad('Failed to load reply link.', 500)

  if (!hasEntitledFeature(resolved.tenant, resolved.billing, 'advanced_crm')) {
    return bad('Reply link is not enabled for this tenant.', 403)
  }

  const body = String((await req.json().catch(() => null))?.body ?? '').trim()
  if (!body) return bad('Reply body is required.', 400)

  const fromPhone = normalizePhone(resolved.businessSettings.phone)
  const toPhone = normalizePhone(resolved.customer.phone)

  if (!fromPhone) return bad('Business phone is not configured.', 400)
  if (!toPhone) return bad('Customer phone is not configured.', 400)

  const outboundState = await canSendOutboundSms({
    tenantId: resolved.tokenRow.tenant_id,
    plan: resolved.tenant.plan,
  })

  if (!outboundState.allowed) {
    console.warn('[reply/token] outbound sms limit reached, blocking quick reply:', {
      tenantId: resolved.tokenRow.tenant_id,
      customerId: resolved.tokenRow.customer_id,
      used: outboundState.used,
      limit: outboundState.limit,
      periodStart: outboundState.periodStart,
    })
    return bad('Monthly SMS limit reached for this account.', 429)
  }

  let threadId = resolved.tokenRow.thread_id

  if (!threadId) {
    const nowIso = new Date().toISOString()

    const { data: newThread, error: threadErr } = await supabaseAdmin
      .from('inbox_threads')
      .insert({
        tenant_id: resolved.tokenRow.tenant_id,
        customer_id: resolved.tokenRow.customer_id,
        source: 'quick_reply',
        status: 'waiting_customer',
        last_message_at: nowIso,
      })
      .select('id')
      .single()

    if (threadErr || !newThread) {
      console.error('[reply/token] thread create failed:', threadErr)
      return bad('Failed to create thread.', 500)
    }

    threadId = newThread.id
  }

  const twilio = getTwilio()
  const smsResult = await twilio.messages.create({
    to: toPhone,
    from: fromPhone,
    body,
  })

  console.log('[reply/token] sms send result:', smsResult)

  const { data: messageRow, error: messageErr } = await supabaseAdmin
    .from('inbox_messages')
    .insert({
      tenant_id: resolved.tokenRow.tenant_id,
      customer_id: resolved.tokenRow.customer_id,
      thread_id: threadId,
      direction: 'outbound',
      channel: 'sms',
      body,
      from_email: fromPhone,
      to_email: toPhone,
    })
    .select('id, direction, body, created_at')
    .single()

  if (messageErr || !messageRow) {
    console.error('[reply/token] inbox message insert failed:', messageErr)
    return bad('Failed to save reply.', 500)
  }

  await recordOutboundAndMaybeWarn({
    tenantId: resolved.tokenRow.tenant_id,
    customerId: resolved.tokenRow.customer_id,
    threadId,
    plan: resolved.tenant.plan,
    direction: 'outbound',
    eventKind: 'quick_reply',
    providerSid: (smsResult as any)?.sid ?? null,
    fromPhone,
    toPhone,
    body,
    segmentCount: 1,
  })

  const nowIso = new Date().toISOString()

  const [{ error: threadUpdateErr }, { error: customerUpdateErr }] = await Promise.all([
    supabaseAdmin
      .from('inbox_threads')
      .update({
        status: 'waiting_customer',
        last_message_at: nowIso,
      })
      .eq('id', threadId)
      .eq('tenant_id', resolved.tokenRow.tenant_id),
    supabaseAdmin
      .from('customers')
      .update({
        inbox_status: 'waiting_customer',
        inbox_last_action_at: nowIso,
      })
      .eq('id', resolved.tokenRow.customer_id)
      .eq('tenant_id', resolved.tokenRow.tenant_id),
  ])

  if (threadUpdateErr) {
    console.error('[reply/token] thread update failed:', threadUpdateErr.message)
  }

  if (customerUpdateErr) {
    console.error('[reply/token] customer update failed:', customerUpdateErr.message)
  }

  return NextResponse.json({
    success: true,
    message: messageRow,
  })
}
