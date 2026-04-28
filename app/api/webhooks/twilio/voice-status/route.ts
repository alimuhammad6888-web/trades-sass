import { NextRequest, NextResponse } from 'next/server'
import { hasEntitledFeature } from '@/lib/entitlements'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { DEFAULT_FEATURES } from '@/lib/tenant'
import { getTwilio } from '@/src/lib/services'
import { canSendOutboundSms, recordOutboundAndMaybeWarn } from '@/src/lib/sms-limits'
import { verifyTwilioWebhook } from '@/src/lib/twilio-webhook'

const MISSED_STATUSES = new Set(['no-answer', 'busy', 'failed', 'canceled'])

function ok() {
  return new NextResponse('<Response></Response>', {
    status: 200,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
    },
  })
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

async function resolveTenantByBusinessNumber(to: string) {
  // TODO: business_settings.phone and notification_phone should be stored
  // in E.164 format, e.g. +19095551234.
  const { data: settingsRow, error: settingsErr } = await supabaseAdmin
    .from('business_settings')
    .select(
      'tenant_id, phone, notification_phone, missed_call_text_enabled, missed_call_auto_reply'
    )
    .eq('phone', to)
    .maybeSingle()

  if (settingsErr) {
    console.error('[twilio/voice-status] business_settings lookup failed:', settingsErr.message)
    return { error: 'lookup_failed' as const }
  }

  if (!settingsRow?.tenant_id) {
    return { error: 'tenant_not_found' as const }
  }

  const tenantId = settingsRow.tenant_id

  const [
    { data: tenantData, error: tenantErr },
    { data: billingData, error: billingErr },
  ] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select('id, name, plan, business_settings(features)')
      .eq('id', tenantId)
      .single(),
    supabaseAdmin
      .from('tenant_billing')
      .select('status, billing_enabled, admin_override, trial_ends_at, current_period_end')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ])

  if (tenantErr || !tenantData) {
    console.error('[twilio/voice-status] tenant lookup failed:', tenantErr?.message)
    return { error: 'tenant_not_found' as const }
  }

  if (billingErr) {
    console.error('[twilio/voice-status] billing lookup failed:', billingErr.message)
    return { error: 'billing_lookup_failed' as const }
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
    tenantId,
    tenant,
    billing: billingData ?? null,
    settings: settingsRow,
  }
}

async function ensureWebhookEvent(
  tenantId: string,
  eventType: 'voice_status',
  providerSid: string
) {
  const { error } = await supabaseAdmin.from('twilio_webhook_events').insert({
    tenant_id: tenantId,
    event_type: eventType,
    provider_sid: providerSid,
  })

  if (!error) return { inserted: true }

  if (error.code === '23505') {
    return { inserted: false }
  }

  console.error('[twilio/voice-status] webhook event insert failed:', error)
  throw error
}

async function findOrCreateCustomer(tenantId: string, phone: string) {
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('customers')
    .select('id, phone')
    .eq('tenant_id', tenantId)
    .eq('phone', phone)
    .maybeSingle()

  if (existingErr) {
    console.error('[twilio/voice-status] customer lookup failed:', existingErr.message)
    throw existingErr
  }

  if (existing?.id) return existing.id

  const { data: created, error: createErr } = await supabaseAdmin
    .from('customers')
    .insert({
      tenant_id: tenantId,
      first_name: 'Caller',
      last_name: phone,
      phone,
    })
    .select('id')
    .single()

  if (createErr || !created) {
    console.error('[twilio/voice-status] customer create failed:', createErr)
    throw createErr ?? new Error('Failed to create customer')
  }

  return created.id
}

async function ensureThread(tenantId: string, customerId: string) {
  const nowIso = new Date().toISOString()

  const { data: latestThread, error: latestThreadErr } = await supabaseAdmin
    .from('inbox_threads')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestThreadErr) {
    console.error('[twilio/voice-status] thread lookup failed:', latestThreadErr.message)
    throw latestThreadErr
  }

  if (latestThread?.id) {
    const { error: updateErr } = await supabaseAdmin
      .from('inbox_threads')
      .update({
        status: 'waiting_customer',
        last_message_at: nowIso,
      })
      .eq('id', latestThread.id)
      .eq('tenant_id', tenantId)

    if (updateErr) {
      console.error('[twilio/voice-status] thread update failed:', updateErr.message)
      throw updateErr
    }

    return latestThread.id
  }

  const { data: createdThread, error: createErr } = await supabaseAdmin
    .from('inbox_threads')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      source: 'twilio_voice',
      status: 'waiting_customer',
      last_message_at: nowIso,
    })
    .select('id')
    .single()

  if (createErr || !createdThread) {
    console.error('[twilio/voice-status] thread create failed:', createErr)
    throw createErr ?? new Error('Failed to create thread')
  }

  return createdThread.id
}

async function insertInboxMessage(params: {
  tenantId: string
  customerId: string
  threadId: string
  direction: 'inbound' | 'outbound'
  body: string
  fromPhone: string | null
  toPhone: string | null
}) {
  const { error } = await supabaseAdmin.from('inbox_messages').insert({
    tenant_id: params.tenantId,
    customer_id: params.customerId,
    thread_id: params.threadId,
    direction: params.direction,
    channel: 'sms',
    body: params.body,
    from_email: params.fromPhone,
    to_email: params.toPhone,
  })

  if (error) {
    console.error('[twilio/voice-status] inbox message insert failed:', error)
    throw error
  }
}

function makeAutoReply(settings: { missed_call_auto_reply: string | null }) {
  return (
    settings.missed_call_auto_reply?.trim() ||
    'Sorry we missed your call — how can we help?'
  )
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const invalidSignature = verifyTwilioWebhook({
      req,
      formData: form,
      pathname: '/api/webhooks/twilio/voice-status',
    })

    if (invalidSignature) {
      return invalidSignature
    }

    const to = normalizePhone(String(form.get('To') ?? ''))
    const from = normalizePhone(String(form.get('From') ?? ''))
    const callSid = String(form.get('CallSid') ?? '').trim()
    const dialCallStatus = String(form.get('DialCallStatus') ?? '').trim().toLowerCase()

    if (!to || !from || !callSid) {
      return ok()
    }

    if (!MISSED_STATUSES.has(dialCallStatus)) {
      return ok()
    }

    const resolved = await resolveTenantByBusinessNumber(to)

    if (resolved.error) return ok()

    if (!hasEntitledFeature(resolved.tenant, resolved.billing, 'advanced_crm')) {
      return ok()
    }

    if (resolved.settings.missed_call_text_enabled !== true) {
      return ok()
    }

    const event = await ensureWebhookEvent(resolved.tenantId, 'voice_status', callSid)
    if (!event.inserted) return ok()

    const customerId = await findOrCreateCustomer(resolved.tenantId, from)
    const threadId = await ensureThread(resolved.tenantId, customerId)
    const autoReply = makeAutoReply(resolved.settings)

    await insertInboxMessage({
      tenantId: resolved.tenantId,
      customerId,
      threadId,
      direction: 'inbound',
      body: `Missed call from ${from}`,
      fromPhone: from,
      toPhone: to,
    })

    const outboundState = await canSendOutboundSms({
      tenantId: resolved.tenantId,
      plan: resolved.tenant.plan,
    })

    if (!outboundState.allowed) {
      console.warn('[twilio/voice-status] outbound sms limit reached, skipping auto-reply:', {
        tenantId: resolved.tenantId,
        used: outboundState.used,
        limit: outboundState.limit,
        periodStart: outboundState.periodStart,
      })
      return ok()
    }

    const twilio = getTwilio()
    const smsResult = await twilio.messages.create({
      to: from,
      from: to,
      body: autoReply,
    })

    console.log('[twilio/voice-status] auto-reply result:', smsResult)

    await insertInboxMessage({
      tenantId: resolved.tenantId,
      customerId,
      threadId,
      direction: 'outbound',
      body: autoReply,
      fromPhone: to,
      toPhone: from,
    })

    await recordOutboundAndMaybeWarn({
      tenantId: resolved.tenantId,
      customerId,
      threadId,
      plan: resolved.tenant.plan,
      direction: 'outbound',
      eventKind: 'missed_call_auto_reply',
      providerSid: (smsResult as any)?.sid ?? null,
      fromPhone: to,
      toPhone: from,
      body: autoReply,
      segmentCount: 1,
    })

    const { error: customerUpdateErr } = await supabaseAdmin
      .from('customers')
      .update({
        inbox_status: 'waiting_customer',
        inbox_last_action_at: new Date().toISOString(),
        phone: from,
      })
      .eq('id', customerId)
      .eq('tenant_id', resolved.tenantId)

    if (customerUpdateErr) {
      console.error(
        '[twilio/voice-status] customer update failed:',
        customerUpdateErr.message
      )
    }

    return ok()
  } catch (err) {
    console.error('[twilio/voice-status] unexpected error:', err)
    return ok()
  }
}
