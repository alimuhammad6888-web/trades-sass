// app/api/bookings/create/route.ts
// Server-side booking creation.
// Validates tenant, service, price, lead time, window, and conflicts.
// The client no longer writes directly to customers/bookings.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Body = {
  slug?:       string
  serviceId?:  string
  starts_at?:  string   // ISO string built by the client
  first_name?: string
  last_name?:  string
  phone?:      string
  email?:      string
  notes?:      string | null
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return bad('Invalid JSON body')
  }

  const slug      = body.slug?.trim()
  const serviceId = body.serviceId?.trim()
  const startsRaw = body.starts_at?.trim()
  const firstName = body.first_name?.trim()
  const lastName  = body.last_name?.trim()
  const phone     = body.phone?.trim()
  const email     = body.email?.trim()
  const notes     = body.notes?.toString().trim() || null

  if (!slug)      return bad('Missing tenant slug')
  if (!serviceId) return bad('Missing serviceId')
  if (!startsRaw) return bad('Missing starts_at')
  if (!firstName) return bad('Missing first_name')
  if (!lastName)  return bad('Missing last_name')
  if (!phone)     return bad('Missing phone')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bad('Valid email required')
  }

  const starts = new Date(startsRaw)
  if (isNaN(starts.getTime())) return bad('Invalid starts_at')

  const admin = supabaseAdmin()

  // 1. Tenant lookup + booking rules
  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .select(`
      id, is_active,
      business_settings (
        booking_lead_time_hours,
        booking_window_days,
        auto_confirm_bookings
      )
    `)
    .eq('slug', slug)
    .single()

  if (tErr || !tenant || !tenant.is_active) {
    return bad('Tenant not found', 404)
  }

  const settings = Array.isArray(tenant.business_settings)
    ? tenant.business_settings[0]
    : tenant.business_settings
  const leadHours   = settings?.booking_lead_time_hours ?? 2
  const windowDays  = settings?.booking_window_days ?? 60
  const autoConfirm = settings?.auto_confirm_bookings === true

  // 2. Service lookup + authoritative price/duration
  const { data: service, error: sErr } = await admin
    .from('services')
    .select('id, tenant_id, name, duration_mins, price_cents, is_active')
    .eq('id', serviceId)
    .eq('tenant_id', tenant.id)
    .single()

  if (sErr || !service || !service.is_active) {
    return bad('Service not found', 404)
  }

  // 3. Derive ends_at from server-trusted duration
  const duration = Number(service.duration_mins) || 60
  const ends = new Date(starts.getTime() + duration * 60_000)
  if (ends.getTime() <= starts.getTime()) {
    return bad('Invalid booking window')
  }

  // 4. Lead time + booking window enforcement
  const now = new Date()
  const earliest = new Date(now.getTime() + leadHours * 60 * 60_000)
  const latest   = new Date(now.getTime() + windowDays * 24 * 60 * 60_000)

  if (starts.getTime() < earliest.getTime()) {
    return bad(`Bookings require at least ${leadHours}h lead time`)
  }
  if (starts.getTime() > latest.getTime()) {
    return bad(`Bookings can only be made within ${windowDays} days`)
  }

  // 5. Conflict check — overlap with active bookings for this tenant
  const startsIso = starts.toISOString()
  const endsIso   = ends.toISOString()

  const { data: conflicts, error: cErr } = await admin
    .from('bookings')
    .select('id, starts_at, ends_at, status')
    .eq('tenant_id', tenant.id)
    .not('status', 'in', '(cancelled,no_show)')
    .lt('starts_at', endsIso)
    .gt('ends_at', startsIso)
    .limit(1)

  if (cErr) return bad('Could not verify availability', 500)
  if (conflicts && conflicts.length > 0) {
    return bad('That time is no longer available', 409)
  }

  // 6. Upsert customer by (tenant_id, phone)
  let customerId: string | null = null
  const { data: existing } = await admin
    .from('customers')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('phone', phone)
    .maybeSingle()

  if (existing?.id) {
    customerId = existing.id
    await admin
      .from('customers')
      .update({ first_name: firstName, last_name: lastName, email })
      .eq('id', existing.id)
  } else {
    const { data: created, error: custErr } = await admin
      .from('customers')
      .insert({
        tenant_id:   tenant.id,
        first_name:  firstName,
        last_name:   lastName,
        phone,
        email,
        lead_source: 'website',
      })
      .select('id')
      .single()

    if (custErr || !created?.id) return bad('Could not save customer', 500)
    customerId = created.id
  }

  // 7. Create booking with server-derived price + status
  const status = autoConfirm ? 'confirmed' : 'pending'
  const { data: booking, error: bErr } = await admin
    .from('bookings')
    .insert({
      tenant_id:    tenant.id,
      customer_id:  customerId,
      service_id:   service.id,
      starts_at:    startsIso,
      ends_at:      endsIso,
      price_cents:  service.price_cents, // authoritative
      notes,
      status,
      confirmed_at: autoConfirm ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (bErr || !booking?.id) {
    return bad('Could not create booking', 500)
  }

  return NextResponse.json({
    success: true,
    bookingId: booking.id,
    autoConfirmed: autoConfirm,
  })
}
