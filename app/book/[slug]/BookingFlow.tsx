'use client'

// app/book/[slug]/BookingFlow.tsx
// All booking UI and state lives here.
// Tenant + services arrive as props from the Server Component (page.tsx),
// so useState is initialised with real data — no useEffect fetch, no null flash.

import { useState } from 'react'
import { hasFeature } from '@/lib/features'

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
  tagline?: string
  primary_color?: string
  accent_color?: string
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
const TIME_MAP: any = {
  '8:00 AM': '08:00',
  '9:00 AM': '09:00',
  '10:00 AM': '10:00',
  '11:00 AM': '11:00',
  '1:00 PM': '13:00',
  '2:00 PM': '14:00',
  '3:00 PM': '15:00',
  '4:00 PM': '16:00',
}

export default function BookingFlow({ slug, initialTenant, initialServices }: Props) {
  const [tenant] = useState<Tenant | null>(initialTenant)
  const [services] = useState<Service[]>(initialServices)

  const [step, setStep] = useState<Step>('service')
  const [selService, setSelService] = useState<Service | null>(null)
  const [selDate, setSelDate] = useState('')
  const [selTime, setSelTime] = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', notes: '' })
  const [errors, setErrors] = useState<any>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [bookingRef, setBookingRef] = useState('')
  const [notifySent, setNotifySent] = useState(false)

  // Feature gate — resolved from server-fetched tenant data, no client fetch
  const paymentsEnabled = hasFeature(tenant, 'payments')

  function validate() {
    const e: any = {}
    if (!form.first_name.trim()) e.first_name = 'Required'
    if (!form.last_name.trim()) e.last_name = 'Required'
    if (!form.phone.trim()) e.phone = 'Required'
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Valid email required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

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
            first_name: form.first_name,
            last_name: form.last_name,
            phone: form.phone,
            email: form.email,
            notes: form.notes,
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
      })
        .then(r => {
          if (r.ok) setNotifySent(true)
        })
        .catch(err => console.error('[booking-notify]', err))
    } catch (err) {
      console.error('[submitBooking]', err)
      setSubmitError('Network error. Please check your connection and try again.')
    }

    setSubmitting(false)
  }

  const Y = tenant?.primary_color || '#F4C300'
  const A = tenant?.accent_color || Y
  const BG = '#0d0d0d'
  const CARD = '#1a1a1a'
  const BORDER = '#2a2a2a'

  const page: any = { minHeight: '100vh', background: BG, color: '#fff', fontFamily: 'sans-serif' }
  const headerS: any = { background: '#111', borderBottom: `3px solid ${Y}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
  const wrap: any = { maxWidth: '560px', margin: '0 auto', padding: '28px 20px' }
  const btn: any = { padding: '12px 24px', background: Y, color: '#000', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: '16px', fontFamily: 'sans-serif' }
  const back: any = { background: 'none', border: 'none', color: '#888', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '16px', fontFamily: 'sans-serif' }
  const inp: any = { width: '100%', padding: '9px 12px', background: '#111', border: `1px solid ${BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '14px', fontFamily: 'sans-serif', boxSizing: 'border-box', outline: 'none' }
  const lbl: any = { fontSize: '11px', fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }
  const err: any = { fontSize: '11px', color: A, marginTop: '3px' }

  const Logo = () => (
    <div style={headerS}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&display=swap');`}</style>
      <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '20px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff' }}>
        {tenant?.name ?? ''}
      </span>
      {tenant?.tagline && <span style={{ fontSize: '12px', color: '#888' }}>{tenant.tagline}</span>}
    </div>
  )

  if (tenant && services.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0d0d', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h2 style={{ color: Y, fontFamily: 'Georgia,serif' }}>{tenant.name}</h2>
          <p style={{ marginTop: '10px', color: '#888' }}>This business is not accepting online bookings yet.</p>
          <p style={{ marginTop: '6px', fontSize: '13px', color: '#666' }}>Please check back later or contact them directly.</p>
        </div>
      </div>
    )
  }

  if (step === 'service') {
    return (
      <div style={page}>
        <Logo />
        <div style={wrap}>
          <h2 style={{ fontFamily: 'Georgia,serif', fontSize: '20px', marginBottom: '8px', color: Y, fontStyle: 'italic' }}>What do you need?</h2>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>Select a service to get started</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {services.map(sv => (
              <button
                key={sv.id}
                onClick={() => { setSelService(sv); setStep('datetime') }}
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '16px 18px', textAlign: 'left', cursor: 'pointer', color: '#fff', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = Y)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
              >
                <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>{sv.name}</div>
                {sv.description && <div style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>{sv.description}</div>}
                <div style={{ fontSize: '12px', color: A }}>{formatDuration(sv.duration_mins)} · {formatPrice(sv.price_cents)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (step === 'datetime') {
    return (
      <div style={page}>
        <Logo />
        <div style={wrap}>
          <button style={back} onClick={() => setStep('service')}>← Back</button>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Georgia,serif', fontSize: '16px', fontStyle: 'italic' }}>Choose a date & time</span>
              <span style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>Step 2 of 4</span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '5px', marginBottom: '20px' }}>
                {getAvailableDates(tenant?.booking_lead_time_hours, tenant?.booking_window_days).map(d => {
                  const label = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
                  const isSel = selDate === label
                  return (
                    <button
                      key={label}
                      onClick={() => { setSelDate(label); setSelTime('') }}
                      style={{ padding: '8px 4px', border: `1.5px solid ${isSel ? Y : BORDER}`, borderRadius: '6px', background: isSel ? Y : '#111', color: isSel ? '#000' : '#fff', cursor: 'pointer', fontSize: '11px', fontFamily: 'sans-serif' }}
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
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Available times</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
                    {TIME_SLOTS.map(t => (
                      <button
                        key={t}
                        onClick={() => setSelTime(t)}
                        style={{ padding: '9px', border: `1.5px solid ${selTime === t ? Y : BORDER}`, borderRadius: '6px', background: selTime === t ? Y : '#111', color: selTime === t ? '#000' : '#fff', cursor: 'pointer', fontSize: '12px', fontFamily: 'monospace', fontWeight: selTime === t ? 700 : 400 }}
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

  if (step === 'details') {
    return (
      <div style={page}>
        <Logo />
        <div style={wrap}>
          <button style={back} onClick={() => setStep('datetime')}>← Back</button>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Georgia,serif', fontSize: '16px', fontStyle: 'italic' }}>Your details</span>
              <span style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>Step 3 of 4</span>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={lbl}>First name</label>
                  <input style={inp} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
                  {errors.first_name && <div style={err}>{errors.first_name}</div>}
                </div>
                <div>
                  <label style={lbl}>Last name</label>
                  <input style={inp} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
                  {errors.last_name && <div style={err}>{errors.last_name}</div>}
                </div>
              </div>
              <div>
                <label style={lbl}>Phone</label>
                <input style={inp} type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" />
                {errors.phone && <div style={err}>{errors.phone}</div>}
                <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>We'll text your confirmation to this number</div>
              </div>
              <div>
                <label style={lbl}>Email</label>
                <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@email.com" />
                {errors.email && <div style={err}>{errors.email}</div>}
                <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>Your confirmation email will be sent here</div>
              </div>
              <div>
                <label style={lbl}>Notes (optional)</label>
                <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. panel is in the garage, street parking only" />
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

  if (step === 'confirm') {
    return (
      <div style={page}>
        <Logo />
        <div style={wrap}>
          <button style={back} onClick={() => setStep('details')}>← Back</button>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Georgia,serif', fontSize: '16px', fontStyle: 'italic' }}>Confirm booking</span>
              <span style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>Step 4 of 4</span>
            </div>
            <div style={{ padding: '20px' }}>
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
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                  <span style={{ fontSize: '13px', color: '#fff', fontWeight: 500 }}>{value}</span>
                </div>
              ))}

              {paymentsEnabled && (
                <div style={{ marginTop: '16px', background: '#111', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '12px', fontSize: '12px', color: '#888' }}>
                  {/* Payment step UI goes here when built */}
                </div>
              )}

              {!paymentsEnabled && (
                <div style={{ marginTop: '16px', background: '#111', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '12px', fontSize: '12px', color: '#888', lineHeight: 1.5 }}>
                  📱 You'll receive a <strong style={{ color: '#fff' }}>text + email confirmation</strong> once the team confirms your appointment.
                </div>
              )}

              {submitError && (
                <div style={{ marginTop: '12px', background: '#2a1010', border: '1px solid #5a2020', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', color: '#ff6b6b' }}>
                  {submitError}
                </div>
              )}

              <button style={{ ...btn, opacity: submitting ? 0.6 : 1 }} disabled={submitting} onClick={submitBooking}>
                {submitting ? 'Submitting...' : 'Submit booking request'}
              </button>

              {!paymentsEnabled && (
                <p style={{ fontSize: '11px', color: '#555', textAlign: 'center', marginTop: '10px' }}>
                  No payment required — we'll confirm and follow up.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      <Logo />
      <div style={{ ...wrap, textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', background: Y, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '20px auto' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 style={{ fontFamily: 'Georgia,serif', fontSize: '24px', color: Y, fontStyle: 'italic', marginBottom: '10px' }}>Request received!</h2>
        <p style={{ color: '#888', fontSize: '14px', lineHeight: 1.7, marginBottom: '6px' }}>
          {selService?.name} · {selDate} at {selTime}
        </p>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>
          Check your phone and email — we've sent you a confirmation. The team will be in touch shortly.
        </p>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '16px', marginBottom: '20px', textAlign: 'left' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', marginBottom: '10px' }}>Notifications sent</div>
          {[
            { label: `Email to ${form.email}`, icon: '📧' },
            { label: `SMS to ${form.phone}`, icon: '📱' },
          ].map(n => (
            <div key={n.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${BORDER}`, fontSize: '13px', color: '#888' }}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
              <span style={{ marginLeft: 'auto', color: '#1a6b4a', fontSize: '11px', fontWeight: 600 }}>✓ Sent</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#111', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '10px 16px', display: 'inline-block' }}>
          <span style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>Booking ref: </span>
          <span style={{ fontSize: '13px', color: Y, fontFamily: 'monospace', fontWeight: 600 }}>{bookingRef}</span>
        </div>
      </div>
    </div>
  )
}