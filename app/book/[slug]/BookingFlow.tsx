'use client'

// app/book/[slug]/BookingFlow.tsx

import { useState } from 'react'
import { hasFeature } from '@/lib/features'
import { adjustHex, getTenantBrandMarkCss, getTenantTheme, tenantPublicChrome } from '@/lib/tenant-theme'

type TenantFeatures = {
  payments?: boolean
  sms?: boolean
  email_confirmations?: boolean
  [key: string]: boolean | undefined
}

type Tenant = {
  id: string
  name: string
  slug: string
  tagline?: string | null
  primary_color?: string | null
  accent_color?: string | null
  bg_color?: string | null
  text_color?: string | null
  booking_lead_time_hours?: number
  booking_window_days?: number
  features?: TenantFeatures
}

type Service = { id: string; name: string; description: string; duration_mins: number; price_cents: number | null }
type Step = 'service' | 'datetime' | 'details' | 'confirm' | 'done'

interface Props {
  slug: string
  initialTenant: Tenant | null
  initialServices: Service[]
}

function formatPrice(cents: number | null) {
  return cents ? '$' + (cents / 100).toFixed(0) : 'Get a quote'
}

function formatDuration(mins: number) {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getAvailableDates(leadTimeHours = 2, windowDays = 60) {
  const dates = []
  const now = new Date()
  const earliest = new Date(now.getTime() + leadTimeHours * 60 * 60 * 1000)
  const latest = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000)
  const startDay = new Date(Math.max(now.getTime(), earliest.getTime()))
  startDay.setDate(startDay.getDate() + 1)
  startDay.setHours(0, 0, 0, 0)

  for (let i = 0; dates.length < 14; i++) {
    const d = new Date(startDay)
    d.setDate(startDay.getDate() + i)
    if (d > latest) break
    if (d.getDay() !== 0) dates.push(d)
  }
  return dates
}

const TIME_SLOTS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM']
const TIME_MAP: Record<string, string> = {
  '8:00 AM': '08:00', '9:00 AM': '09:00', '10:00 AM': '10:00', '11:00 AM': '11:00',
  '1:00 PM': '13:00', '2:00 PM': '14:00', '3:00 PM': '15:00',  '4:00 PM': '16:00',
}

export default function BookingFlow({ slug, initialTenant, initialServices }: Props) {
  const [tenant]   = useState<Tenant | null>(initialTenant)
  const [services] = useState<Service[]>(initialServices)

  const [step, setStep]           = useState<Step>('service')
  const [selService, setSelService] = useState<Service | null>(null)
  const [selDate, setSelDate]     = useState('')
  const [selTime, setSelTime]     = useState('')
  const [form, setForm]           = useState({ first_name: '', last_name: '', phone: '', email: '', notes: '' })
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [bookingRef, setBookingRef] = useState('')

  const paymentsEnabled = hasFeature(tenant, 'payments')

  // ── Theme ─────────────────────────────────────────────────────────────────
  const { brand, accent, bg, textColor, bgSurface, bgCard, bgBorder, textMuted } = getTenantTheme(tenant, {
    fallbackBg: '#0d0d0d',
    bgSurfaceAmount: 10,
    bgCardAmount: 16,
    bgBorderAmount: 28,
    textMutedAmount: -130,
  })

  // ── Validation ────────────────────────────────────────────────────────────
  function validate() {
    const e: Record<string, string> = {}
    if (!form.first_name.trim()) e.first_name = 'Required'
    if (!form.last_name.trim())  e.last_name  = 'Required'
    if (!form.phone.trim())      e.phone      = 'Required'
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Valid email required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function submitBooking() {
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          serviceId: selService!.id,
          date: selDate,
          time: TIME_MAP[selTime],
          customer: {
            first_name: form.first_name, last_name: form.last_name,
            phone: form.phone, email: form.email, notes: form.notes,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      setBookingRef(data.bookingRef)
      setStep('done')
      fetch('/api/booking-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: data.bookingId }),
      }).catch(err => console.error('[booking-notify]', err))
    } catch (err) {
      console.error('[submitBooking]', err)
      setSubmitError('Network error. Please check your connection and try again.')
    }
    setSubmitting(false)
  }

  // ── Shared style helpers ─────────────────────────────────────────────────
  const page: React.CSSProperties    = { minHeight: '100vh', background: bg, color: textColor, fontFamily: tenantPublicChrome.fontSans }
  const wrap: React.CSSProperties    = { maxWidth: '560px', margin: '0 auto', padding: '28px 20px' }
  const cardWrap: React.CSSProperties = { background: bgCard, border: `1px solid ${bgBorder}`, borderRadius: '10px', overflow: 'hidden' }
  const cardHead: React.CSSProperties = { padding: '14px 20px', borderBottom: `1px solid ${bgBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
  const cardBody: React.CSSProperties = { padding: '20px' }
  const btn: React.CSSProperties     = { padding: '12px 24px', background: brand, color: bg, border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: '16px', fontFamily: tenantPublicChrome.fontDisplay, textTransform: 'uppercase', letterSpacing: '0.08em' }
  const back: React.CSSProperties    = { background: 'none', border: 'none', color: textMuted, fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '16px', fontFamily: tenantPublicChrome.fontSans }
  const inp: React.CSSProperties     = { width: '100%', padding: '9px 12px', background: bgSurface, border: `1px solid ${bgBorder}`, borderRadius: '6px', color: textColor, fontSize: '14px', fontFamily: tenantPublicChrome.fontSans, boxSizing: 'border-box', outline: 'none' }
  const lbl: React.CSSProperties     = { fontSize: '11px', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }
  const errStyle: React.CSSProperties = { fontSize: '11px', color: accent, marginTop: '3px' }

  // ── Nav ───────────────────────────────────────────────────────────────────
  const Nav = () => (
    <>
      <style suppressHydrationWarning>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${bg}; }
        .booking-nav { position: fixed; top: 0; left: 0; right: 0; height: ${tenantPublicChrome.navHeight}; background: ${bg}f2; backdrop-filter: blur(12px); border-bottom: 1px solid ${bgBorder}; display: flex; align-items: center; justify-content: space-between; padding: ${tenantPublicChrome.navPadding}; z-index: 100; }
        ${getTenantBrandMarkCss('.booking-nav-logo', textColor)}
        .booking-nav-logo { text-decoration: none; }
        .booking-service-btn:hover { border-color: ${brand} !important; }
        .booking-date-btn:hover { opacity: 0.85; }
        .booking-inp-focus:focus { border-color: ${brand} !important; box-shadow: 0 0 0 2px ${brand}33; }
        @media (max-width: 500px) { .booking-nav { padding: ${tenantPublicChrome.navPaddingMobile}; } }
      `}</style>
      <nav className="booking-nav">
        <a href={`/t/${slug}`} className="booking-nav-logo">{tenant?.name ?? ''}</a>
        {tenant?.tagline && (
          <span style={{ fontSize: '12px', color: textMuted }}>{tenant.tagline}</span>
        )}
      </nav>
    </>
  )

  // ── No services state ─────────────────────────────────────────────────────
  if (tenant && services.length === 0) {
    return (
      <div style={page}>
        <Nav />
        <div style={{ paddingTop: '80px', padding: '80px 40px 40px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: tenantPublicChrome.fontDisplay, fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', color: brand, marginBottom: '10px' }}>{tenant.name}</h2>
          <p style={{ color: textMuted, fontSize: '14px', lineHeight: 1.6 }}>This business is not accepting online bookings yet.</p>
          <p style={{ marginTop: '6px', fontSize: '13px', color: adjustHex(textMuted, -30) }}>Please check back later or contact them directly.</p>
        </div>
      </div>
    )
  }

  // ── Step: service ─────────────────────────────────────────────────────────
  if (step === 'service') {
    return (
      <div style={page}>
        <Nav />
        <div style={{ ...wrap, paddingTop: '80px' }}>
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em', color: accent, marginBottom: '6px' }}>Step 1 of 4</div>
            <h2 style={{ fontFamily: tenantPublicChrome.fontDisplay, fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', color: textColor, marginBottom: '4px' }}>What do you need?</h2>
            <p style={{ fontSize: '13px', color: textMuted }}>Select a service to get started</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
            {services.map(sv => (
              <button
                key={sv.id}
                className="booking-service-btn"
                onClick={() => { setSelService(sv); setStep('datetime') }}
                style={{ background: bgCard, border: `1px solid ${bgBorder}`, borderRadius: '8px', padding: '16px 18px', textAlign: 'left', cursor: 'pointer', color: textColor, transition: 'border-color 0.15s', fontFamily: tenantPublicChrome.fontSans }}
              >
                <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px', color: textColor }}>{sv.name}</div>
                {sv.description && <div style={{ fontSize: '13px', color: textMuted, marginBottom: '8px' }}>{sv.description}</div>}
                <div style={{ fontSize: '12px', color: accent, fontWeight: 600 }}>{formatDuration(sv.duration_mins)} · {formatPrice(sv.price_cents)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Step: datetime ────────────────────────────────────────────────────────
  if (step === 'datetime') {
    return (
      <div style={page}>
        <Nav />
        <div style={{ ...wrap, paddingTop: '80px' }}>
          <button style={back} onClick={() => setStep('service')}>← Back</button>
          <div style={cardWrap}>
            <div style={cardHead}>
              <span style={{ fontFamily: tenantPublicChrome.fontDisplay, fontSize: '18px', fontWeight: 700, textTransform: 'uppercase', color: textColor }}>Choose a date & time</span>
              <span style={{ fontSize: '11px', color: textMuted, fontFamily: 'monospace' }}>Step 2 of 4</span>
            </div>
            <div style={cardBody}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '5px', marginBottom: '20px' }}>
                {getAvailableDates(tenant?.booking_lead_time_hours, tenant?.booking_window_days).map(d => {
                  const label = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
                  const isSel = selDate === label
                  return (
                    <button
                      key={label}
                      onClick={() => { setSelDate(label); setSelTime('') }}
                      style={{ padding: '8px 4px', border: `1.5px solid ${isSel ? brand : bgBorder}`, borderRadius: '6px', background: isSel ? brand : bgSurface, color: isSel ? bg : textColor, cursor: 'pointer', fontSize: '11px', fontFamily: tenantPublicChrome.fontSans, transition: 'all 0.15s' }}
                    >
                      <div style={{ fontSize: '9px', opacity: 0.7 }}>{'Su Mo Tu We Th Fr Sa'.split(' ')[d.getDay()]}</div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{d.getDate()}</div>
                      <div style={{ fontSize: '9px', opacity: 0.7 }}>{'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[d.getMonth()]}</div>
                    </button>
                  )
                })}
              </div>
              {selDate && (
                <>
                  <div style={{ fontSize: '11px', color: textMuted, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Available times</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
                    {TIME_SLOTS.map(t => (
                      <button
                        key={t}
                        onClick={() => setSelTime(t)}
                        style={{ padding: '9px', border: `1.5px solid ${selTime === t ? brand : bgBorder}`, borderRadius: '6px', background: selTime === t ? brand : bgSurface, color: selTime === t ? bg : textColor, cursor: 'pointer', fontSize: '12px', fontFamily: 'monospace', fontWeight: selTime === t ? 700 : 400, transition: 'all 0.15s' }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button style={{ ...btn, opacity: selDate && selTime ? 1 : 0.4 }} disabled={!selDate || !selTime} onClick={() => setStep('details')}>
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: details ─────────────────────────────────────────────────────────
  if (step === 'details') {
    return (
      <div style={page}>
        <Nav />
        <div style={{ ...wrap, paddingTop: '80px' }}>
          <button style={back} onClick={() => setStep('datetime')}>← Back</button>
          <div style={cardWrap}>
            <div style={cardHead}>
              <span style={{ fontFamily: tenantPublicChrome.fontDisplay, fontSize: '18px', fontWeight: 700, textTransform: 'uppercase', color: textColor }}>Your details</span>
              <span style={{ fontSize: '11px', color: textMuted, fontFamily: 'monospace' }}>Step 3 of 4</span>
            </div>
            <div style={{ ...cardBody, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={lbl}>First name</label>
                  <input className="booking-inp-focus" style={inp} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
                  {errors.first_name && <div style={errStyle}>{errors.first_name}</div>}
                </div>
                <div>
                  <label style={lbl}>Last name</label>
                  <input className="booking-inp-focus" style={inp} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
                  {errors.last_name && <div style={errStyle}>{errors.last_name}</div>}
                </div>
              </div>
              <div>
                <label style={lbl}>Phone</label>
                <input className="booking-inp-focus" style={inp} type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" />
                {errors.phone && <div style={errStyle}>{errors.phone}</div>}
                <div style={{ fontSize: '11px', color: textMuted, marginTop: '4px' }}>We'll text your confirmation to this number</div>
              </div>
              <div>
                <label style={lbl}>Email</label>
                <input className="booking-inp-focus" style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@email.com" />
                {errors.email && <div style={errStyle}>{errors.email}</div>}
                <div style={{ fontSize: '11px', color: textMuted, marginTop: '4px' }}>Your confirmation email will be sent here</div>
              </div>
              <div>
                <label style={lbl}>Notes (optional)</label>
                <textarea className="booking-inp-focus" style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. panel is in the garage, street parking only" />
              </div>
              <button style={btn} onClick={() => { if (validate()) setStep('confirm') }}>
                Review booking
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: confirm ─────────────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <div style={page}>
        <Nav />
        <div style={{ ...wrap, paddingTop: '80px' }}>
          <button style={back} onClick={() => setStep('details')}>← Back</button>
          <div style={cardWrap}>
            <div style={cardHead}>
              <span style={{ fontFamily: tenantPublicChrome.fontDisplay, fontSize: '18px', fontWeight: 700, textTransform: 'uppercase', color: textColor }}>Confirm booking</span>
              <span style={{ fontSize: '11px', color: textMuted, fontFamily: 'monospace' }}>Step 4 of 4</span>
            </div>
            <div style={cardBody}>
              {[
                ['Service',  selService?.name],
                ['Date',     selDate],
                ['Time',     selTime],
                ['Duration', formatDuration(selService?.duration_mins ?? 0)],
                ['Price',    formatPrice(selService?.price_cents ?? null)],
                ['Name',     `${form.first_name} ${form.last_name}`],
                ['Phone',    form.phone],
                ['Email',    form.email],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${bgBorder}` }}>
                  <span style={{ fontSize: '11px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                  <span style={{ fontSize: '13px', color: textColor, fontWeight: 500 }}>{value}</span>
                </div>
              ))}

              {!paymentsEnabled && (
                <div style={{ marginTop: '16px', background: bgSurface, border: `1px solid ${bgBorder}`, borderRadius: '6px', padding: '12px', fontSize: '12px', color: textMuted, lineHeight: 1.5 }}>
                  📱 You'll receive a <strong style={{ color: textColor }}>text + email confirmation</strong> once the team confirms your appointment.
                </div>
              )}

              {submitError && (
                <div style={{ marginTop: '12px', background: adjustHex(bg, 4), border: `1px solid ${adjustHex(bg, 40)}`, borderLeft: `3px solid #ef4444`, borderRadius: '6px', padding: '10px 14px', fontSize: '13px', color: '#f87171' }}>
                  {submitError}
                </div>
              )}

              <button style={{ ...btn, opacity: submitting ? 0.6 : 1 }} disabled={submitting} onClick={submitBooking}>
                {submitting ? 'Submitting...' : 'Submit booking request'}
              </button>

              {!paymentsEnabled && (
                <p style={{ fontSize: '11px', color: textMuted, textAlign: 'center', marginTop: '10px' }}>
                  No payment required — we'll confirm and follow up.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: done ────────────────────────────────────────────────────────────
  return (
    <div style={page}>
      <Nav />
      <div style={{ ...wrap, paddingTop: '80px', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', background: brand, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '20px auto' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke={bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 style={{ fontFamily: tenantPublicChrome.fontDisplay, fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', color: brand, marginBottom: '10px' }}>Request received!</h2>
        <p style={{ color: textMuted, fontSize: '14px', lineHeight: 1.7, marginBottom: '6px' }}>
          {selService?.name} · {selDate} at {selTime}
        </p>
        <p style={{ color: adjustHex(textMuted, -20), fontSize: '13px', marginBottom: '24px' }}>
          Check your phone and email — we've sent you a confirmation. The team will be in touch shortly.
        </p>

        <div style={{ background: bgCard, border: `1px solid ${bgBorder}`, borderRadius: '8px', padding: '16px', marginBottom: '20px', textAlign: 'left' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: textMuted, marginBottom: '10px' }}>Notifications sent</div>
          {[
            { label: `Email to ${form.email}`, icon: '📧' },
            { label: `SMS to ${form.phone}`,   icon: '📱' },
          ].map(n => (
            <div key={n.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${bgBorder}`, fontSize: '13px', color: textMuted }}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
              <span style={{ marginLeft: 'auto', color: '#1a6b4a', fontSize: '11px', fontWeight: 600 }}>✓ Sent</span>
            </div>
          ))}
        </div>

        <div style={{ background: bgSurface, border: `1px solid ${bgBorder}`, borderRadius: '6px', padding: '10px 16px', display: 'inline-block' }}>
          <span style={{ fontSize: '11px', color: textMuted, fontFamily: 'monospace' }}>Booking ref: </span>
          <span style={{ fontSize: '13px', color: brand, fontFamily: 'monospace', fontWeight: 600 }}>{bookingRef}</span>
        </div>
      </div>
    </div>
  )
}
