import { NextRequest, NextResponse } from 'next/server'
import { hasEntitledFeature } from '@/lib/entitlements'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { DEFAULT_FEATURES } from '@/lib/tenant'
import { verifyTwilioWebhook } from '@/src/lib/twilio-webhook'

function xml(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
    },
  })
}

function escapeXml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
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
    console.error('[twilio/voice] business_settings lookup failed:', settingsErr.message)
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
    console.error('[twilio/voice] tenant lookup failed:', tenantErr?.message)
    return { error: 'tenant_not_found' as const }
  }

  if (billingErr) {
    console.error('[twilio/voice] billing lookup failed:', billingErr.message)
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
    billing: billingData ?? null,
    tenant,
    settings: settingsRow,
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const invalidSignature = verifyTwilioWebhook({
    req,
    formData: form,
    pathname: '/api/webhooks/twilio/voice',
  })

  if (invalidSignature) {
    return invalidSignature
  }

  const to = normalizePhone(String(form.get('To') ?? ''))
  const from = normalizePhone(String(form.get('From') ?? ''))

  if (!to || !from) {
    return xml('<Response><Say>Invalid call request.</Say></Response>')
  }

  const resolved = await resolveTenantByBusinessNumber(to)

  if (resolved.error) {
    return xml('<Response><Say>We could not route your call.</Say></Response>')
  }

  if (!hasEntitledFeature(resolved.tenant, resolved.billing, 'advanced_crm')) {
    return xml('<Response><Say>This number is not currently available.</Say></Response>')
  }

  const forwardTo = normalizePhone(resolved.settings.notification_phone)

  if (!forwardTo) {
    console.error('[twilio/voice] missing notification_phone for tenant:', resolved.tenantId)
    return xml('<Response><Say>We are unavailable right now. Please try again later.</Say></Response>')
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const actionUrl = `${baseUrl}/api/webhooks/twilio/voice-status`

  // We use <Dial action="..."> so Twilio posts the final dial result
  // to the voice-status route after the forwarded call ends.
  //
  // The voice-status route expects:
  // - From
  // - To
  // - CallSid
  // - DialCallStatus
  //
  // Twilio includes DialCallStatus on the action callback, and the
  // original call context is preserved for the callback request.
  return xml(
    `<Response>
      <Dial action="${escapeXml(actionUrl)}" method="POST" timeout="20">
        <Number>${escapeXml(forwardTo)}</Number>
      </Dial>
    </Response>`
  )
}
