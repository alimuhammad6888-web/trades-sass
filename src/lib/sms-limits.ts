import { resolvePlanName } from '@/lib/features'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getResend } from '@/src/lib/services'

export type SmsEventKind =
  | 'inbound_customer_sms'
  | 'missed_call_auto_reply'
  | 'owner_notification'
  | 'quick_reply'

export type SmsDirection = 'inbound' | 'outbound'

export type SmsUsageEventInput = {
  tenantId: string
  customerId?: string | null
  threadId?: string | null
  direction: SmsDirection
  eventKind: SmsEventKind
  providerSid?: string | null
  fromPhone?: string | null
  toPhone?: string | null
  body?: string | null
  segmentCount?: number | null
}

type OutboundCheckInput = {
  tenantId: string
  plan: string | null | undefined
}

type OutboundWarningInput = SmsUsageEventInput &
  OutboundCheckInput & {
    providerSid?: string | null
  }

const OUTBOUND_LIMITED_KINDS = new Set<SmsEventKind>([
  'missed_call_auto_reply',
  'owner_notification',
  'quick_reply',
])

const WARNING_THRESHOLDS = [80, 95, 100] as const

const DEFAULT_SMS_LIMITS: Record<string, number> = {
  starter: 0,
  pro: 250,
  enterprise: 2000,
}

function getPeriodStart(date = new Date()): string {
  const utcYear = date.getUTCFullYear()
  const utcMonth = date.getUTCMonth()
  return new Date(Date.UTC(utcYear, utcMonth, 1)).toISOString().slice(0, 10)
}

function getNextPeriodStart(periodStart: string): string {
  const [year, month] = periodStart.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1 + 1, 1))
  return next.toISOString().slice(0, 10)
}

function getCanonicalPlan(plan: string | null | undefined): string {
  return resolvePlanName(plan) ?? 'starter'
}

async function getMonthlySmsLimit(plan: string | null | undefined): Promise<number> {
  const canonicalPlan = getCanonicalPlan(plan)

  const { data, error } = await supabaseAdmin
    .from('sms_plan_limits')
    .select('monthly_sms_limit')
    .eq('plan', canonicalPlan)
    .maybeSingle()

  if (error) {
    console.error('[sms-limits] failed to load sms plan limit:', error.message)
    return DEFAULT_SMS_LIMITS[canonicalPlan] ?? 0
  }

  return data?.monthly_sms_limit ?? DEFAULT_SMS_LIMITS[canonicalPlan] ?? 0
}

async function getOutboundSmsUsageCount(tenantId: string, periodStart?: string): Promise<number> {
  const start = periodStart ?? getPeriodStart()
  const end = getNextPeriodStart(start)

  const { count, error } = await supabaseAdmin
    .from('sms_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('direction', 'outbound')
    .in('event_kind', Array.from(OUTBOUND_LIMITED_KINDS))
    .gte('created_at', start)
    .lt('created_at', end)

  if (error) {
    console.error('[sms-limits] failed to count outbound sms usage:', error.message)
    throw error
  }

  return count ?? 0
}

async function getNotificationEmail(tenantId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('business_settings')
    .select('notification_email, email')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    console.error('[sms-limits] failed to load business settings for warning email:', error.message)
    return null
  }

  return data?.notification_email?.trim() || data?.email?.trim() || null
}

async function getTenantName(tenantId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  if (error || !data?.name) {
    if (error) {
      console.error('[sms-limits] failed to load tenant name:', error.message)
    }
    return 'Your business'
  }

  return data.name
}

async function sendThresholdWarningEmail(params: {
  tenantId: string
  thresholdPercent: (typeof WARNING_THRESHOLDS)[number]
  used: number
  limit: number
  periodStart: string
}) {
  const to = await getNotificationEmail(params.tenantId)

  if (!to) {
    console.warn('[sms-limits] notification email missing for tenant warning:', {
      tenantId: params.tenantId,
      thresholdPercent: params.thresholdPercent,
      periodStart: params.periodStart,
    })
    return false
  }

  const tenantName = await getTenantName(params.tenantId)
  const resend = getResend()
  const monthLabel = new Date(`${params.periodStart}T00:00:00.000Z`).toLocaleDateString(
    'en-US',
    { month: 'long', year: 'numeric', timeZone: 'UTC' }
  )

  const subject =
    params.thresholdPercent >= 100
      ? `${tenantName}: monthly SMS limit reached`
      : `${tenantName}: SMS usage at ${params.thresholdPercent}%`

  const text =
    params.thresholdPercent >= 100
      ? `You have used ${params.used} of ${params.limit} SMS for ${monthLabel}. Your monthly SMS limit has been reached.`
      : `You have used ${params.used} of ${params.limit} SMS for ${monthLabel}. This account has reached ${params.thresholdPercent}% of its monthly SMS limit.`

  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'noreply@yourdomain.com',
      to,
      subject,
      text,
    } as any)

    const resendError = (result as any)?.error

    if (resendError) {
      console.error('[sms-limits] resend returned error for threshold warning:', resendError)
      return false
    }

    return true
  } catch (error) {
    console.error('[sms-limits] failed to send threshold warning email:', error)
    return false
  }
}

async function markWarningSent(
  tenantId: string,
  periodStart: string,
  thresholdPercent: (typeof WARNING_THRESHOLDS)[number]
): Promise<boolean> {
  const { error } = await supabaseAdmin.from('sms_usage_warnings').insert({
    tenant_id: tenantId,
    period_start: periodStart,
    threshold_percent: thresholdPercent,
  })

  if (!error) return true

  if (error.code === '23505') {
    return false
  }

  console.error('[sms-limits] failed to insert warning record:', error.message)
  throw error
}

async function maybeSendThresholdWarnings(params: {
  tenantId: string
  used: number
  limit: number
  periodStart: string
}) {
  const percentUsed =
    params.limit <= 0 ? 100 : Math.floor((params.used / params.limit) * 100)

  for (const threshold of WARNING_THRESHOLDS) {
    if (percentUsed < threshold) continue

    const sent = await sendThresholdWarningEmail({
      tenantId: params.tenantId,
      thresholdPercent: threshold,
      used: params.used,
      limit: params.limit,
      periodStart: params.periodStart,
    })

    if (!sent) {
      console.warn('[sms-limits] warning email was not sent; warning record will not be created:', {
        tenantId: params.tenantId,
        threshold,
        periodStart: params.periodStart,
      })
      continue
    }

    const recorded = await markWarningSent(params.tenantId, params.periodStart, threshold)

    if (!recorded) {
      console.warn('[sms-limits] warning email sent but threshold was already recorded:', {
        tenantId: params.tenantId,
        threshold,
        periodStart: params.periodStart,
      })
    }
  }
}

export async function recordSmsUsageEvent(input: SmsUsageEventInput) {
  const { data, error } = await supabaseAdmin
    .from('sms_usage_events')
    .insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId ?? null,
      thread_id: input.threadId ?? null,
      direction: input.direction,
      event_kind: input.eventKind,
      provider_sid: input.providerSid ?? null,
      from_phone: input.fromPhone ?? null,
      to_phone: input.toPhone ?? null,
      body: input.body ?? null,
      segment_count: input.segmentCount ?? 1,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('[sms-limits] failed to record sms usage event:', error)
    throw error ?? new Error('Failed to record sms usage event')
  }

  return data
}

export async function canSendOutboundSms(input: OutboundCheckInput) {
  const periodStart = getPeriodStart()
  const limit = await getMonthlySmsLimit(input.plan)
  const used = await getOutboundSmsUsageCount(input.tenantId, periodStart)
  const remaining = Math.max(limit - used, 0)
  const allowed = limit > 0 && used < limit

  return {
    allowed,
    limit,
    used,
    remaining,
    periodStart,
  }
}

export async function recordOutboundAndMaybeWarn(input: OutboundWarningInput) {
  if (!OUTBOUND_LIMITED_KINDS.has(input.eventKind)) {
    throw new Error(`Unsupported outbound sms event kind: ${input.eventKind}`)
  }

  const usageEvent = await recordSmsUsageEvent({
    ...input,
    direction: 'outbound',
  })

  const periodStart = getPeriodStart()
  const limit = await getMonthlySmsLimit(input.plan)
  const used = await getOutboundSmsUsageCount(input.tenantId, periodStart)

  await maybeSendThresholdWarnings({
    tenantId: input.tenantId,
    used,
    limit,
    periodStart,
  })

  return {
    usageEvent,
    limit,
    used,
    remaining: Math.max(limit - used, 0),
    periodStart,
  }
}

export async function recordInboundSmsUsage(
  input: Omit<SmsUsageEventInput, 'direction' | 'eventKind'> & {
    eventKind?: 'inbound_customer_sms'
  }
) {
  return recordSmsUsageEvent({
    ...input,
    direction: 'inbound',
    eventKind: input.eventKind ?? 'inbound_customer_sms',
  })
}
