// app/api/booking-notify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }) }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) }
function fmtPrice(cents: number|null) { return cents ? '$'+(cents/100).toFixed(0) : 'Quote on request' }
function fmtDuration(mins: number) { if(mins<60)return`${mins} min`;const h=Math.floor(mins/60),m=mins%60;return m>0?`${h}h ${m}m`:`${h}h` }

function makeToken(bookingId: string, exp: string) {
  return crypto.createHmac('sha256', process.env.CRON_SECRET ?? 'secret')
    .update(`${bookingId}:${exp}`).digest('hex').slice(0, 16)
}

async function sendEmail({ to, subject, html, text }: { to:string; subject:string; html:string; text:string }) {
  if (process.env.USE_MOCK_EMAIL === 'true' || !process.env.RESEND_API_KEY) {
    console.log(`\n[MOCK EMAIL → ${to}]\nSubject: ${subject}\n${text}\n`)
    return { ok: true }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? 'noreply@yourdomain.com', to, subject, html }),
  })
  return { ok: res.ok }
}

async function sendSMS({ to, body }: { to:string; body:string }) {
  if (process.env.USE_MOCK_SMS === 'true' || !process.env.TWILIO_ACCOUNT_SID) {
    console.log(`\n[MOCK SMS → ${to}]\n${body}\n`)
    return { ok: true }
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_PHONE_NUMBER ?? '', Body: body }).toString(),
  })
  return { ok: res.ok }
}

export async function POST(req: NextRequest) {
  try {
    const { bookingId } = await req.json()
    if (!bookingId) return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, starts_at, ends_at, price_cents, notes, status,
        customers ( first_name, last_name, email, phone ),
        services  ( name, duration_mins ),
        tenants   ( id, name,
          business_settings (
            email, phone, primary_color,
            notification_email, notification_phone
          )
        )
      `)
      .eq('id', bookingId)
      .single()

    if (error || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    const customer  = booking.customers as any
    const service   = booking.services  as any
    const tenant    = booking.tenants   as any
    const settings  = Array.isArray(tenant?.business_settings) ? tenant.business_settings[0] : tenant?.business_settings

    const bizName   = tenant?.name ?? 'Your service provider'
    const accent    = settings?.primary_color ?? '#F4C300'
    const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trades-sass.vercel.app'
    const exp       = String(Date.now() + 72 * 60 * 60 * 1000)
    const token     = makeToken(bookingId, exp)
    const confirmUrl = `${baseUrl}/api/booking-confirm?id=${bookingId}&token=${token}&exp=${exp}`
    const bookingRef = bookingId.slice(0, 8).toUpperCase()
    const dateStr   = fmtDate(booking.starts_at)
    const timeStr   = fmtTime(booking.starts_at)
    const price     = fmtPrice(booking.price_cents)
    const duration  = fmtDuration(service?.duration_mins ?? 60)

    // ── Resolve where owner notifications go ──────────────────────
    // notification_email/phone takes priority; falls back to business contact details
    const ownerEmail = settings?.notification_email || settings?.email
    const ownerPhone = settings?.notification_phone || settings?.phone

    console.log(`[booking-notify] ${bookingRef} — owner email: ${ownerEmail ?? 'not set'}, owner SMS: ${ownerPhone ?? 'not set'}`)

    // ── Customer email ────────────────────────────────────────────
    const customerHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f2ee;font-family:sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e8e4dc;">
    <div style="background:#1a1917;padding:20px 28px;border-bottom:3px solid ${accent};">
      <div style="color:${accent};font-size:20px;font-weight:700;font-family:Georgia,serif;font-style:italic;">${bizName}</div>
    </div>
    <div style="padding:28px;">
      <h1 style="font-family:Georgia,serif;font-size:22px;color:#1a1917;margin:0 0 8px;font-style:italic;">You're booked, ${customer?.first_name}!</h1>
      <p style="color:#9a9590;font-size:14px;margin:0 0 24px;">We've received your request and will confirm shortly.</p>
      <div style="background:#f8f6f1;border-radius:8px;padding:20px;margin-bottom:24px;">
        ${[['Service',service?.name],['Date',dateStr],['Time',timeStr],['Duration',duration],['Price',price],['Ref #',bookingRef]].map(([l,v])=>`
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8e4dc;">
            <span style="font-size:12px;color:#9a9590;text-transform:uppercase;letter-spacing:0.06em;">${l}</span>
            <span style="font-size:13px;font-weight:600;color:#1a1917;">${v}</span>
          </div>`).join('')}
      </div>
      ${booking.notes ? `<p style="background:#eef4fb;border-left:3px solid #3B82C4;padding:12px;font-size:13px;color:#1e4d8c;border-radius:0 6px 6px 0;margin-bottom:20px;">Your note: ${booking.notes}</p>` : ''}
      <p style="font-size:13px;color:#9a9590;line-height:1.6;margin:0;">— The ${bizName} team</p>
    </div>
  </div>
</div></body></html>`

    const customerText = `Hi ${customer?.first_name},\n\nYour booking request is received!\n\nService: ${service?.name}\nDate: ${dateStr}\nTime: ${timeStr}\nPrice: ${price}\nRef: ${bookingRef}\n\nWe'll confirm shortly.\n\n— ${bizName}`

    // ── Owner email ───────────────────────────────────────────────
    const ownerHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f2ee;font-family:sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e8e4dc;">
    <div style="background:#1a1917;padding:20px 28px;border-bottom:3px solid ${accent};">
      <div style="color:${accent};font-size:16px;font-weight:700;">🔔 New Booking Request</div>
      <div style="color:#9a9590;font-size:12px;margin-top:4px;">${bizName}</div>
    </div>
    <div style="padding:28px;">
      <h2 style="font-family:Georgia,serif;font-size:20px;color:#1a1917;margin:0 0 20px;font-style:italic;">${customer?.first_name} ${customer?.last_name} wants to book</h2>
      <div style="background:#f8f6f1;border-radius:8px;padding:20px;margin-bottom:24px;">
        ${[
          ['Customer', `${customer?.first_name} ${customer?.last_name}`],
          ['Phone',    customer?.phone ?? 'Not provided'],
          ['Email',    customer?.email ?? 'Not provided'],
          ['Service',  service?.name],
          ['Date',     dateStr],
          ['Time',     timeStr],
          ['Price',    price],
        ].map(([l,v])=>`
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8e4dc;">
            <span style="font-size:12px;color:#9a9590;text-transform:uppercase;letter-spacing:0.06em;">${l}</span>
            <span style="font-size:13px;font-weight:600;color:#1a1917;">${v}</span>
          </div>`).join('')}
        ${booking.notes ? `<div style="padding:8px 0;"><span style="font-size:12px;color:#9a9590;text-transform:uppercase;">Note</span><p style="font-size:13px;color:#1a1917;margin:4px 0 0;">${booking.notes}</p></div>` : ''}
      </div>
      <div style="text-align:center;margin-bottom:16px;">
        <a href="${confirmUrl}" style="display:inline-block;padding:14px 32px;background:${accent};color:#000;font-weight:700;font-size:15px;text-decoration:none;border-radius:6px;">
          ✓ Confirm this booking
        </a>
      </div>
      <p style="font-size:12px;color:#9a9590;text-align:center;margin:0 0 8px;">Or reply <strong>YES</strong> to your SMS to confirm.</p>
      <p style="font-size:11px;color:#c8c4bc;text-align:center;margin:0;">
        Also available in your <a href="${baseUrl}/dashboard/bookings" style="color:#9a9590;">dashboard</a>.
      </p>
    </div>
  </div>
</div></body></html>`

    const ownerText = `New booking!\n\n${customer?.first_name} ${customer?.last_name}\nPhone: ${customer?.phone}\nEmail: ${customer?.email}\n\nService: ${service?.name}\nDate: ${dateStr} at ${timeStr}\nPrice: ${price}\n${booking.notes?`Note: ${booking.notes}\n`:''}\nConfirm: ${confirmUrl}\n\nOr reply YES to SMS.`

    // ── SMS bodies ────────────────────────────────────────────────
    const customerSMS = `Hi ${customer?.first_name}! Your ${service?.name} request with ${bizName} is received for ${dateStr} at ${timeStr}. We'll confirm shortly. Ref: ${bookingRef}`
    const ownerSMS    = `🔔 New booking: ${customer?.first_name} ${customer?.last_name} → ${service?.name} on ${dateStr} at ${timeStr}. Reply YES to confirm.\n${confirmUrl}`

    // ── Send all ──────────────────────────────────────────────────
    const results = await Promise.allSettled([
      customer?.email ? sendEmail({ to:customer.email, subject:`Booking received — ${service?.name} on ${dateStr}`, html:customerHtml, text:customerText }) : Promise.resolve({ ok:false }),
      customer?.phone ? sendSMS({ to:customer.phone, body:customerSMS }) : Promise.resolve({ ok:false }),
      ownerEmail ? sendEmail({ to:ownerEmail, subject:`🔔 New booking: ${customer?.first_name} ${customer?.last_name} — ${service?.name}`, html:ownerHtml, text:ownerText }) : Promise.resolve({ ok:false }),
      ownerPhone ? sendSMS({ to:ownerPhone, body:ownerSMS }) : Promise.resolve({ ok:false }),
    ])

    const [cEmail, cSMS, oEmail, oSMS] = results.map(r => r.status === 'fulfilled' ? r.value : { ok:false })

    return NextResponse.json({
      success: true,
      sent: {
        customerEmail: (cEmail as any)?.ok,
        customerSMS:   (cSMS  as any)?.ok,
        ownerEmail:    (oEmail as any)?.ok,
        ownerSMS:      (oSMS  as any)?.ok,
      }
    })

  } catch (err: any) {
    console.error('[booking-notify]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
