// app/api/booking-confirm/route.ts
// Handles the magic link from the owner's email.
// GET ?id=BOOKING_ID&token=TOKEN&exp=TIMESTAMP → confirms booking and redirects to dashboard.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function makeConfirmToken(bookingId: string, exp: string) {
  return crypto.createHmac('sha256', process.env.CRON_SECRET ?? 'secret')
    .update(`${bookingId}:${exp}`)
    .digest('hex')
    .slice(0, 16)
}

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchParams } = new URL(req.url)
  const id    = searchParams.get('id')
  const token = searchParams.get('token')
  const exp   = searchParams.get('exp')
  const base  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trades-sass.vercel.app'

  // ── 1. Require all params ──────────────────────────────────────
  if (!id || !token || !exp) {
    return NextResponse.redirect(`${base}/dashboard/bookings?confirm=invalid`)
  }

  // ── 2. Check link expiry ───────────────────────────────────────
  const expMs = parseInt(exp, 10)
  if (isNaN(expMs) || Date.now() > expMs) {
    return NextResponse.redirect(`${base}/dashboard/bookings?confirm=expired`)
  }

  // ── 3. Verify HMAC token (covers both id and exp) ─────────────
  const expected = makeConfirmToken(id, exp)
  if (token !== expected) {
    return NextResponse.redirect(`${base}/dashboard/bookings?confirm=invalid`)
  }

  // ── 4. Fetch booking ──────────────────────────────────────────
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', id)
    .single()

  if (!booking) {
    return NextResponse.redirect(`${base}/dashboard/bookings?confirm=notfound`)
  }

  // ── 5. Status guards ──────────────────────────────────────────
  if (booking.status === 'confirmed') {
    return NextResponse.redirect(`${base}/dashboard/bookings?confirm=already`)
  }

  if (booking.status !== 'pending') {
    // cancelled, completed, etc. — don't allow confirmation
    return NextResponse.redirect(`${base}/dashboard/bookings?confirm=cancelled`)
  }

  // ── 6. Confirm the booking ────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending') // extra safety: only update if still pending

  if (updateErr) {
    console.error('[booking-confirm] update failed:', updateErr)
    return NextResponse.redirect(`${base}/dashboard/bookings?confirm=error`)
  }

  return NextResponse.redirect(`${base}/dashboard/bookings?confirm=success&booking=${id}`)
}
