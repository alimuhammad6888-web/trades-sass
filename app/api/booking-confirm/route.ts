// app/api/booking-confirm/route.ts
// Handles the magic link from the owner's email.
// GET ?id=BOOKING_ID&token=TOKEN → confirms booking and redirects to dashboard.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function makeConfirmToken(bookingId: string) {
  return crypto.createHmac('sha256', process.env.CRON_SECRET ?? 'secret')
    .update(bookingId)
    .digest('hex')
    .slice(0, 16)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id    = searchParams.get('id')
  const token = searchParams.get('token')
  const base  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trades-sass.vercel.app'

  if (!id || !token) {
    return NextResponse.redirect(`${base}/dashboard/bookings?confirm=invalid`)
  }

  // Verify token
  const expected = makeConfirmToken(id)
  if (token !== expected) {
    return NextResponse.redirect(`${base}/dashboard/bookings?confirm=invalid`)
  }

  // Fetch booking to check it exists and isn't already confirmed
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', id)
    .single()

  if (!booking) {
    return NextResponse.redirect(`${base}/dashboard/bookings?confirm=notfound`)
  }

  if (booking.status === 'confirmed') {
    // Already confirmed — redirect with a note
    return NextResponse.redirect(`${base}/dashboard/bookings?confirm=already`)
  }

  if (booking.status === 'cancelled') {
    return NextResponse.redirect(`${base}/dashboard/bookings?confirm=cancelled`)
  }

  // Confirm the booking
  await supabase
    .from('bookings')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.redirect(`${base}/dashboard/bookings?confirm=success&booking=${id}`)
}
