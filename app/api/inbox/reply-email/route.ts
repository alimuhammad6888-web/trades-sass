import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hasEntitledFeature } from '@/lib/entitlements'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { DEFAULT_FEATURES } from '@/lib/tenant'
import { getResend } from '@/src/lib/services'

type ReplyBody = {
  customer_id?: string
  subject?: string
  body?: string
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
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

function summarizeError(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    }
  }

  return {
    message: typeof err === 'string' ? err : JSON.stringify(err),
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) return bad('Unauthorized', 401)

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return bad('Supabase env vars are not configured', 500)
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
    console.error('[inbox/reply-email] auth error:', authErr?.message)
    return bad('Unauthorized', 401)
  }

  const payload = (await req.json().catch(() => null)) as ReplyBody | null

  const customerId = payload?.customer_id?.trim()
  const subject = payload?.subject?.trim() || 'Re: Inquiry'
  const body = payload?.body?.trim()

  if (!customerId) return bad('customer_id is required', 400)
  if (!body) return bad('Reply body is required', 400)

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from('users')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .single()

  if (userErr) {
    console.error('[inbox/reply-email] failed to load user tenant:', userErr.message)
    return bad('Failed to verify tenant', 500)
  }

  if (!userRow?.tenant_id) {
    return bad('Tenant not found', 404)
  }

  const tenantId = userRow.tenant_id

  const [
    { data: tenantData, error: tenantErr },
    { data: billingData, error: billingErr },
    { data: customer, error: customerErr },
  ] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select('id, name, plan, business_settings(features, email)')
      .eq('id', tenantId)
      .single(),
    supabaseAdmin
      .from('tenant_billing')
      .select('status, billing_enabled, admin_override, trial_ends_at, current_period_end')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabaseAdmin
      .from('customers')
      .select('id, tenant_id, first_name, last_name, email')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ])

  if (tenantErr || !tenantData) {
    console.error('[inbox/reply-email] failed to load tenant:', tenantErr?.message)
    return bad('Tenant not found', 404)
  }

  if (billingErr) {
    console.error('[inbox/reply-email] failed to load billing:', billingErr.message)
    return bad('Failed to load billing record', 500)
  }

  if (customerErr) {
    console.error('[inbox/reply-email] failed to load customer:', customerErr.message)
    return bad('Failed to load customer', 500)
  }

  if (!customer) {
    return bad('Customer not found', 404)
  }

  if (!customer.email) {
    return bad('Customer does not have an email address on file', 400)
  }

  const settings = Array.isArray(tenantData.business_settings)
    ? tenantData.business_settings[0]
    : tenantData.business_settings

  const tenant = {
    id: tenantData.id,
    plan: tenantData.plan,
    features: { ...DEFAULT_FEATURES, ...(settings?.features ?? {}) },
  }

  if (!hasEntitledFeature(tenant, billingData ?? null, 'advanced_crm')) {
    return bad('Inbox access is not enabled for this tenant', 403)
  }

  const nowIso = new Date().toISOString()

  let threadId: string | null = null

  const { data: latestThread, error: latestThreadErr } = await supabaseAdmin
    .from('inbox_threads')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestThreadErr) {
    console.error('[inbox/reply-email] failed to load thread:', latestThreadErr.message)
    return bad('Failed to load thread', 500)
  }

  if (latestThread?.id) {
    threadId = latestThread.id

    const { error: threadUpdateErr } = await supabaseAdmin
      .from('inbox_threads')
      .update({
        status: 'waiting_customer',
        last_message_at: nowIso,
      })
      .eq('id', threadId)
      .eq('tenant_id', tenantId)

    if (threadUpdateErr) {
      console.error('[inbox/reply-email] failed to update thread:', threadUpdateErr.message)
      return bad('Failed to update thread', 500)
    }
  } else {
    const { data: newThread, error: threadInsertErr } = await supabaseAdmin
      .from('inbox_threads')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        source: 'dashboard_reply',
        status: 'waiting_customer',
        last_message_at: nowIso,
      })
      .select('id')
      .single()

    if (threadInsertErr || !newThread) {
      console.error('[inbox/reply-email] failed to create thread:', threadInsertErr)
      return bad('Failed to create thread', 500)
    }

    threadId = newThread.id
  }

  const resend = getResend()
  const fromEmail = process.env.EMAIL_FROM ?? 'noreply@yourdomain.com'
  const replyTo = settings?.email ?? undefined
  const customerName =
    [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || customer.email

  try {
    console.log('[inbox/reply-email] sending email:', {
      useMockEmail: process.env.USE_MOCK_EMAIL,
      hasResendKey: !!process.env.RESEND_API_KEY,
      fromEmail,
      to: customer.email,
    })

    const resendResult = await resend.emails.send({
      from: fromEmail,
      to: customer.email,
      subject,
      text: body,
      html: `
        <div style="font-family:sans-serif;line-height:1.6;color:#1a1917;">
          <p>Hi ${escapeHtml(customerName)},</p>
          <div>${formatHtmlBody(body)}</div>
          <p style="margin-top:24px;">— ${escapeHtml(tenantData.name)}</p>
        </div>
      `,
      reply_to: replyTo,
    } as any)

    console.log('[inbox/reply-email] resend result:', resendResult)

    const resendError = (resendResult as any)?.error

    if (resendError) {
      console.error('[inbox/reply-email] resend returned error:', resendError)
      return bad(resendError.message ?? 'Failed to send email', 500)
    }
  } catch (sendErr) {
    console.error('[inbox/reply-email] resend send failed:', {
      tenantId,
      customerId,
      subject,
      to: customer.email,
      from: fromEmail,
      error: summarizeError(sendErr),
    })
    return bad('Failed to send email', 500)
  }

  const { data: messageRow, error: messageErr } = await supabaseAdmin
    .from('inbox_messages')
    .insert({
      thread_id: threadId,
      tenant_id: tenantId,
      customer_id: customerId,
      direction: 'outbound',
      channel: 'email',
      subject,
      body,
      from_email: fromEmail,
      to_email: customer.email,
    })
    .select('*')
    .single()

  if (messageErr || !messageRow) {
    console.error('[inbox/reply-email] failed to save outbound message:', messageErr)
    return bad('Failed to save message', 500)
  }

  const { error: customerUpdateErr } = await supabaseAdmin
    .from('customers')
    .update({
      inbox_status: 'waiting_customer',
      inbox_last_action_at: nowIso,
    })
    .eq('id', customerId)
    .eq('tenant_id', tenantId)

  if (customerUpdateErr) {
    console.error('[inbox/reply-email] failed to update customer status:', customerUpdateErr.message)
  }

  return NextResponse.json({
    success: true,
    thread_id: threadId,
    message: messageRow,
  })
}