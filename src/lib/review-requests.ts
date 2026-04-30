import crypto from 'crypto'
import { FROM_NUMBER, getTwilio } from '@/src/lib/services'
import { supabaseAdmin } from '@/lib/supabase-admin'

type ReviewTokenParams = {
  tenantId: string
  customerId: string
  bookingId: string
}

type SendReviewRequestParams = ReviewTokenParams

type MaybeTriggerParams = {
  tenantId: string
  bookingId: string
}

type BookingContext = {
  id: string
  tenant_id: string
  customer_id: string | null
  status: string
  customers: {
    id?: string
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
  } | null
  tenants: {
    id?: string
    name?: string | null
    business_settings?: {
      phone?: string | null
    } | {
      phone?: string | null
    }[] | null
  } | null
}

function makeToken(): string {
  return crypto.randomBytes(24).toString('hex')
}

function makeExpiryDate(): Date {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 14)
  return expiresAt
}

function getReviewBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) {
    return configured.replace(/\/+$/, '')
  }

  return 'http://localhost:3000'
}

function getReviewUrl(token: string): string {
  return `${getReviewBaseUrl()}/review/${token}`
}

function getBusinessSettings(
  tenant: BookingContext['tenants']
): { phone?: string | null } | null {
  if (!tenant?.business_settings) return null

  return Array.isArray(tenant.business_settings)
    ? tenant.business_settings[0] ?? null
    : tenant.business_settings
}

async function loadBookingContext(params: MaybeTriggerParams): Promise<BookingContext | null> {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select(`
      id,
      tenant_id,
      customer_id,
      status,
      customers (
        id,
        first_name,
        last_name,
        phone
      ),
      tenants (
        id,
        name,
        business_settings (
          phone
        )
      )
    `)
    .eq('id', params.bookingId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle()

  if (error) {
    console.error('[review-requests] failed to load booking context:', error.message)
    return null
  }

  return (data as BookingContext | null) ?? null
}

export async function getOrCreateReviewToken({
  tenantId,
  customerId,
  bookingId,
}: ReviewTokenParams): Promise<{ token: string; expiresAt: string }> {
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('review_tokens')
    .select('id, token, expires_at')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (existingErr) {
    console.error('[review-requests] failed to load review token:', existingErr.message)
    throw existingErr
  }

  if (existing?.token && existing?.expires_at) {
    const expiresAtMs = new Date(existing.expires_at).getTime()

    if (!Number.isNaN(expiresAtMs) && expiresAtMs > Date.now()) {
      return {
        token: existing.token,
        expiresAt: existing.expires_at,
      }
    }

    const refreshedToken = makeToken()
    const refreshedExpiry = makeExpiryDate().toISOString()

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('review_tokens')
      .update({
        token: refreshedToken,
        expires_at: refreshedExpiry,
        used_at: null,
      })
      .eq('id', existing.id)
      .select('token, expires_at')
      .single()

    if (updateErr || !updated) {
      console.error('[review-requests] failed to refresh review token:', updateErr?.message)
      throw updateErr ?? new Error('Failed to refresh review token')
    }

    return {
      token: updated.token,
      expiresAt: updated.expires_at,
    }
  }

  const token = makeToken()
  const expiresAt = makeExpiryDate().toISOString()

  const { data: created, error: createErr } = await supabaseAdmin
    .from('review_tokens')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      booking_id: bookingId,
      token,
      expires_at: expiresAt,
    })
    .select('token, expires_at')
    .single()

  if (createErr || !created) {
    console.error('[review-requests] failed to create review token:', createErr?.message)
    throw createErr ?? new Error('Failed to create review token')
  }

  return {
    token: created.token,
    expiresAt: created.expires_at,
  }
}

export async function sendReviewRequestSms({
  tenantId,
  customerId,
  bookingId,
}: SendReviewRequestParams): Promise<{
  ok: boolean
  skipped?: boolean
  reason?: string
  token?: string
  reviewUrl?: string
  smsSid?: string
}> {
  try {
    const booking = await loadBookingContext({ tenantId, bookingId })

    if (!booking) {
      return {
        ok: false,
        skipped: true,
        reason: 'booking_not_found',
      }
    }

    const customerPhone = booking.customers?.phone?.trim() || null

    if (!customerPhone) {
      return {
        ok: false,
        skipped: true,
        reason: 'missing_customer_phone',
      }
    }

    const settings = getBusinessSettings(booking.tenants)
    const fromPhone = settings?.phone?.trim() || FROM_NUMBER

    if (!fromPhone) {
      return {
        ok: false,
        skipped: true,
        reason: 'missing_from_phone',
      }
    }

    const tokenResult = await getOrCreateReviewToken({
      tenantId,
      customerId,
      bookingId,
    })

    const reviewUrl = getReviewUrl(tokenResult.token)
    const businessName = booking.tenants?.name?.trim() || 'your business'
    const body = `Thanks for choosing ${businessName}! How was your experience? ${reviewUrl}`

    try {
      const twilio = getTwilio()
      const smsResult = await twilio.messages.create({
        to: customerPhone,
        from: fromPhone,
        body,
      })

      return {
        ok: true,
        token: tokenResult.token,
        reviewUrl,
        smsSid: (smsResult as { sid?: string } | null)?.sid ?? undefined,
      }
    } catch (error) {
      console.error('[review-requests] failed to send review request sms:', error)
      return {
        ok: false,
        reason: 'sms_send_failed',
        token: tokenResult.token,
        reviewUrl,
      }
    }
  } catch (error) {
    console.error('[review-requests] sendReviewRequestSms unexpected error:', error)
    return {
      ok: false,
      reason: 'unexpected_error',
    }
  }
}

export async function maybeTriggerReviewRequestForCompletedBooking({
  tenantId,
  bookingId,
}: MaybeTriggerParams): Promise<{
  ok: boolean
  skipped?: boolean
  reason?: string
  token?: string
  reviewUrl?: string
  smsSid?: string
}> {
  try {
    const booking = await loadBookingContext({ tenantId, bookingId })

    if (!booking) {
      return {
        ok: false,
        skipped: true,
        reason: 'booking_not_found',
      }
    }

    if (booking.status !== 'completed') {
      return {
        ok: false,
        skipped: true,
        reason: 'booking_not_completed',
      }
    }

    const customerId = booking.customer_id ?? booking.customers?.id ?? null

    if (!customerId) {
      return {
        ok: false,
        skipped: true,
        reason: 'missing_customer_id',
      }
    }

    return sendReviewRequestSms({
      tenantId,
      customerId,
      bookingId,
    })
  } catch (error) {
    console.error('[review-requests] maybeTriggerReviewRequestForCompletedBooking unexpected error:', error)
    return {
      ok: false,
      reason: 'unexpected_error',
    }
  }
}
