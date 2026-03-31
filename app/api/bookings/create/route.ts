// app/api/bookings/create/route.ts
// Server-side booking creation — validates tenant, service, upserts customer, creates booking.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_TIMES = [
  '08:00','09:00','10:00','11:00',
  '13:00','14:00','15:00','16:00',
]

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const body = await req.json()
    const { slug, serviceId, date, time, customer } = body

    // ── 1. Validate required fields ───────────────────────────────
    if (!slug || !serviceId || !date || !time || !customer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { first_name, last_name, phone, email, notes } = customer
    if (!first_name?.trim()) return NextResponse.json({ error: 'First name is required' }, { status: 400 })
    if (!last_name?.trim())  return NextResponse.json({ error: 'Last name is required' }, { status: 400 })
    if (!phone?.trim())      return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
    if (!email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    // ── 2. Validate time is an allowed slot ─────────────────────
    if (!ALLOWED_TIMES.includes(time)) {
      return NextResponse.json({ error: 'Invalid time slot' }, { status: 400 })
    }

    // ── 3. Resolve tenant by slug ─────────────────────────────────
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name, is_active')
      .eq('slug', slug)
      .single()

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // ── 4. Verify tenant is active ────────────────────────────────
    if (tenant.is_active === false) {
      return NextResponse.json({ error: 'This business is not currently accepting bookings' }, { status: 403 })
    }

    const tenantId = tenant.id

    // ── 5. Load booking rules from business_settings ──────────────
    const { data: settings } = await supabase
      .from('business_settings')
      .select('booking_lead_time_hours, booking_window_days, auto_confirm_bookings')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const leadTimeHours  = settings?.booking_lead_time_hours ?? 2
    const windowDays     = settings?.booking_window_days ?? 60
    const autoConfirm    = settings?.auto_confirm_bookings ?? false

    // ── 6. Verify service belongs to tenant and is active ──────────
    const { data: service, error: serviceErr } = await supabase
      .from('services')
      .select('id, name, duration_mins, price_cents, is_active')
      .eq('id', serviceId)
      .eq('tenant_id', tenantId)
      .single()

    if (serviceErr || !service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }
    if (!service.is_active) {
      return NextResponse.json({ error: 'This service is no longer available' }, { status: 400 })
    }

    // ── 7. Build starts_at and ends_at ────────────────────────────
    const [month, day, year] = date.split('/')
    if (!month || !day || !year) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}:00`
    const starts = new Date(isoDate)
    if (isNaN(starts.getTime())) {
      return NextResponse.json({ error: 'Invalid date/time' }, { status: 400 })
    }
    const ends = new Date(starts.getTime() + service.duration_mins * 60000)

    // ── 8. Enforce lead time ────────────────────────────────────
    const now = new Date()
    const minStart = new Date(now.getTime() + leadTimeHours * 60 * 60 * 1000)
    if (starts < minStart) {
      return NextResponse.json({
        error: `Bookings require at least ${leadTimeHours} hours notice. Please choose a later time.`,
      }, { status: 400 })
    }

    // ── 9. Enforce booking window ───────────────────────────────
    const maxStart = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000)
    if (starts > maxStart) {
      return NextResponse.json({
        error: `Bookings can only be made up to ${windowDays} days in advance.`,
      }, { status: 400 })
    }

    // ── 10. Check for overlapping bookings ────────────────────────
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('starts_at', starts.toISOString())
      .in('status', ['pending', 'confirmed'])
      .limit(1)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: 'This time slot is no longer available. Please choose another.' }, { status: 409 })
    }

    // ── 11. Normalize phone and upsert customer ───────────────────
    const cleanPhone = normalizePhone(phone)

    const { data: existing, error: lookupErr } = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', cleanPhone)
      .maybeSingle()

    if (lookupErr) {
      console.error('[bookings/create] customer lookup failed:', lookupErr)
      return NextResponse.json({ error: 'Failed to look up customer' }, { status: 500 })
    }

    let customerId: string

    if (existing) {
      customerId = existing.id
      await supabase
        .from('customers')
        .update({ first_name: first_name.trim(), last_name: last_name.trim(), email: email.trim() })
        .eq('id', existing.id)
    } else {
      const { data: newCustomer, error: insertErr } = await supabase
        .from('customers')
        .insert({
          tenant_id: tenantId,
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          phone: cleanPhone,
          email: email.trim(),
          lead_source: 'website',
        })
        .select('id')
        .single()

      if (insertErr || !newCustomer) {
        console.error('[bookings/create] customer insert failed:', insertErr)
        return NextResponse.json({ error: 'Failed to create customer record' }, { status: 500 })
      }
      customerId = newCustomer.id
    }

    // ── 12. Create booking ────────────────────────────────────────
    const bookingStatus = autoConfirm ? 'confirmed' : 'pending'
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert({
        tenant_id:    tenantId,
        customer_id:  customerId,
        service_id:   service.id,
        starts_at:    starts.toISOString(),
        ends_at:      ends.toISOString(),
        price_cents:  service.price_cents,
        notes:        notes?.trim() || null,
        status:       bookingStatus,
        ...(autoConfirm ? { confirmed_at: new Date().toISOString() } : {}),
      })
      .select('id')
      .single()

    if (bookingErr || !booking) {
      console.error('[bookings/create] booking insert failed:', bookingErr)
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    // ── 13. Return success ────────────────────────────────────────
    return NextResponse.json({
      success:       true,
      bookingId:     booking.id,
      bookingRef:    booking.id.slice(0, 8).toUpperCase(),
      autoConfirmed: autoConfirm,
    })

  } catch (err: any) {
    console.error('[bookings/create] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
