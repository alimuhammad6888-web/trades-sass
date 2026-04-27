import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { hasEntitledFeature } from '@/lib/entitlements'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { DEFAULT_FEATURES } from '@/lib/tenant'
import { getTwilio } from '@/src/lib/services'

function ok() {
  return new NextResponse('', { status: 200 })
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
    console.error('[twilio/inbound-sms] business_settings lookup failed:', settingsErr.message)
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
    console.error('[twilio/inbound-sms] tenant lookup failed:', tenantErr?.message)
    return { error: 'tenant_not_found' as const }
  }

  if (billingErr) {
    console.error('[twilio/inbound-sms] billing lookup failed:', billingErr.message)
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
    tenantName: tenantData.name,
    tenant,
    billing: billingData ?? null,
    settings: settingsRow,
  }
}

async function ensureWebhookEvent(
  tenantId: string,
  eventType: 'inbound_sms',
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

  console.error('[twilio/inbound-sms] webhook event insert failed:', error)
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
    console.error('[twilio/inbound-sms] customer lookup failed:', existingErr.message)
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
    console.error('[twilio/inbound-sms] customer create failed:', createErr)
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
    console.error('[twilio/inbound-sms] thread lookup failed:', latestThreadErr.message)
    throw latestThreadErr
  }

  if (latestThread?.id) {
    const { error: updateErr } = await supabaseAdmin
      .from('inbox_threads')
      .update({
        status: 'new',
        last_message_at: nowIso,
      })
      .eq('id', latestThread.id)
      .eq('tenant_id', tenantId)

    if (updateErr) {
      console.error('[twilio/inbound-sms] thread update failed:', updateErr.message)
      throw updateErr
    }

    return latestThread.id
  }

  const { data: createdThread, error: createErr } = await supabaseAdmin
    .from('inbox_threads')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      source: 'twilio_sms',
      status: 'new',
      last_message_at: nowIso,
    })
    .select('id')
    .single()

  if (createErr || !createdThread) {
    console.error('[twilio/inbound-sms] thread create failed:', createErr)
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
    console.error('[twilio/inbound-sms] inbox message insert failed:', error)
    throw error
  }
}

async function createQuickReplyToken(params: {
  tenantId: string
  customerId: string
  threadId: string
}) {
  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { data, error } = await supabaseAdmin
    .from('quick_reply_tokens')
    .insert({
      token,
      tenant_id: params.tenantId,
      customer_id: params.customerId,
      thread_id: params.threadId,
      expires_at: expiresAt.toISOString(),
    })
    .select('token')
    .single()

  if (error || !data) {
    console.error('[twilio/inbound-sms] quick reply token create failed:', error)
    throw error ?? new Error('Failed to create quick reply token')
  }

  return data.token
}

function buildOwnerSms(params: {
  tenantName: string
  callerPhone: string
  body: string
  replyUrl: string
}) {
  const preview =
    params.body.length > 90 ? `${params.body.slice(0, 87)}...` : params.body

  return `${params.tenantName}: new text from ${params.callerPhone}\n"${preview}"\nReply: ${params.replyUrl}`
}

export async function POST(req: NextRequest) {
  // TODO: Verify Twilio signatures before production.

  try {
    const form = await req.formData()
    const from = normalizePhone(String(form.get('From') ?? ''))
    const to = normalizePhone(String(form.get('To') ?? ''))
    const body = String(form.get('Body') ?? '').trim()
    const messageSid = String(form.get('MessageSid') ?? '').trim()

    if (!from || !to || !body || !messageSid) {
      return ok()
    }

    const resolved = await resolveTenantByBusinessNumber(to)

    if (resolved.error) return ok()

    if (!hasEntitledFeature(resolved.tenant, resolved.billing, 'advanced_crm')) {
      return ok()
    }

    const ownerPhone = normalizePhone(resolved.settings.notification_phone)
    if (!ownerPhone) {
      console.error(
        '[twilio/inbound-sms] missing notification_phone for tenant:',
        resolved.tenantId
      )
      return ok()
    }

    const event = await ensureWebhookEvent(resolved.tenantId, 'inbound_sms', messageSid)
    if (!event.inserted) return ok()

    const customerId = await findOrCreateCustomer(resolved.tenantId, from)
    const threadId = await ensureThread(resolved.tenantId, customerId)

    await insertInboxMessage({
      tenantId: resolved.tenantId,
      customerId,
      threadId,
      direction: 'inbound',
      body,
      fromPhone: from,
      toPhone: to,
    })

    const token = await createQuickReplyToken({
      tenantId: resolved.tenantId,
      customerId,
      threadId,
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    const replyUrl = `${baseUrl}/reply/${token}`

    const ownerSms = buildOwnerSms({
      tenantName: resolved.tenantName,
      callerPhone: from,
      body,
      replyUrl,
    })

    const twilio = getTwilio()
    const smsResult = await twilio.messages.create({
      to: ownerPhone,
      from: to,
      body: ownerSms,
    })

    console.log('[twilio/inbound-sms] owner notification result:', smsResult)

    const { error: customerUpdateErr } = await supabaseAdmin
      .from('customers')
      .update({
        inbox_status: 'waiting_you',
        inbox_last_action_at: new Date().toISOString(),
        phone: from,
      })
      .eq('id', customerId)
      .eq('tenant_id', resolved.tenantId)

    if (customerUpdateErr) {
      console.error(
        '[twilio/inbound-sms] customer update failed:',
        customerUpdateErr.message
      )
    }

    return ok()
  } catch (err) {
    console.error('[twilio/inbound-sms] unexpected error:', err)
    return ok()
  }
}
