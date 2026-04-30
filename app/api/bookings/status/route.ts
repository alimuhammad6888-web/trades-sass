import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { maybeTriggerReviewRequestForCompletedBooking } from '@/src/lib/review-requests'

const VALID_STATUSES = new Set([
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
])

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return bad('Unauthorized', 401)
  }

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
    console.error('[bookings/status] auth error:', authErr?.message)
    return bad('Unauthorized', 401)
  }

  const body = await req.json().catch(() => null)
  const bookingId = body?.bookingId
  const status = body?.status

  if (!bookingId || typeof bookingId !== 'string') {
    return bad('bookingId is required')
  }

  if (!status || typeof status !== 'string') {
    return bad('status is required')
  }

  if (!VALID_STATUSES.has(status)) {
    return bad('Invalid booking status')
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from('users')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .single()

  if (userErr) {
    console.error('[bookings/status] failed to load user tenant:', userErr.message)
    return bad('Failed to verify tenant', 500)
  }

  if (!userRow?.tenant_id) {
    return bad('Tenant not found', 404)
  }

  const tenantId = userRow.tenant_id

  const { data: booking, error: bookingErr } = await supabaseAdmin
    .from('bookings')
    .select('id, tenant_id, status, confirmed_at')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (bookingErr) {
    console.error('[bookings/status] failed to load booking:', bookingErr.message)
    return bad('Failed to load booking', 500)
  }

  if (!booking) {
    return bad('Booking not found', 404)
  }

  const previousStatus = booking.status
  const nextStatus = status

  const updatePayload: Record<string, string> = {
    status: nextStatus,
  }

  if (nextStatus === 'confirmed') {
    updatePayload.confirmed_at = new Date().toISOString()
  }

  const { error: updateErr } = await supabaseAdmin
    .from('bookings')
    .update(updatePayload)
    .eq('id', booking.id)
    .eq('tenant_id', tenantId)

  if (updateErr) {
    console.error('[bookings/status] failed to update booking:', updateErr.message)
    return bad('Failed to update booking', 500)
  }

  const shouldTriggerReviewRequest =
    previousStatus !== 'completed' && nextStatus === 'completed'

  const reviewRequest = shouldTriggerReviewRequest
    ? await maybeTriggerReviewRequestForCompletedBooking({
        tenantId,
        bookingId: booking.id,
      })
    : {
        ok: false,
        skipped: true,
        reason: 'not_completed_transition',
      }

  return NextResponse.json({
    success: true,
    booking: {
      id: booking.id,
      previousStatus,
      status: nextStatus,
      confirmedAt: updatePayload.confirmed_at ?? booking.confirmed_at ?? null,
    },
    reviewRequest,
  })
}
