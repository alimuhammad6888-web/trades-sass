'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TENANT_ID = '11111111-1111-1111-1111-111111111111'

type Service = { id: string; name: string; description: string; duration_mins: number; price_cents: number | null }
type Step = 'service' | 'datetime' | 'details' | 'confirm' | 'done'

export default function BookPage() {
  const [step, setStep] = useState<Step>('service')
  const [services, setServices] = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', notes: '' })
  const [errors, setErrors] = useState<any>({})
  const [submitting, setSubmitting] = useState(false)
  const [bookingId, setBookingId] = useState('')

  useEffect(() => {
    supabase
      .from('services')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('display_order')
      .then(({ data }) => setServices(data ?? []))
  }, [])

  function formatPrice(cents: number | null) {
    if (!cents) return 'Quote on request'
    return '$' + (cents / 100).toFixed(0)
  }

  function formatDuration(mins: number) {
    if (mins < 60) return mins + ' min'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? h + 'h ' + m + 'm' : h + 'h'
  }

  function getAvailableDates() {
    const dates = []
    const today = new Date()
    for (let i = 1; dates.length < 14; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      if (d.getDay() !== 0) dates.push(d)
    }
    return dates
  }

  function getTimeSlots() {
    return ['8:00 AM','9:00 AM','10:00 AM','11:00 AM','1:00 PM','2:00 PM','3:00 PM','4:00 PM']
  }

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

    const { data: customer } = await supabase
      .from('customers')
      .insert({
        tenant_id: TENANT_ID,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        email: form.email,
        lead_source: 'website',
      })
      .select('id')
      .single() as any

    if (!customer) { setSubmitting(false); return }

    const timeMap: any = {
      '8:00 AM': '08:00', '9:00 AM': '09:00', '10:00 AM': '10:00',
      '11:00 AM': '11:00', '1:00 PM': '13:00', '2:00 PM': '14:00',
      '3:00 PM': '15:00', '4:00 PM': '16:00'
    }
    const [month, day, year] = selectedDate.split('/')
    const starts = new Date(year + '-' + month.padStart(2,'0') + '-' + day.padStart(2,'0') + 'T' + timeMap[selectedTime] + ':00')
    const ends = new Date(starts.getTime() + selectedService!.duration_mins * 60000)

    const { data: booking } = await supabase
      .from('bookings')
      .insert({
        tenant_id: TENANT_ID,
        customer_id: customer.id,
        service_id: selectedService!.id,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        price_cents: selectedService!.price_cents,
        notes: form.notes || null,
        status: 'pending',
      })
      .select('id')
      .single() as any

    setBookingId(booking?.id?.slice(0,8).toUpperCase() ?? 'BBE00001')
    setSubmitting(false)
    setStep('done')
  }

  const yellow = '#F4C300'
  const dark = '#0d0d0d'
  const card = '#1a1a1a'
  const border = '#2a2a2a'

  const pageStyle: any = { minHeight: '100vh', background: dark, color: '#fff', fontFamily: 'sans-serif' }
  const headerStyle: any = { background: '#111', borderBottom: '3px solid ' + yellow, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
  const wrapStyle: any = { maxWidth: '560px', margin: '0 auto', padding: '32px 20px' }
  const btnStyle: any = { padding: '12px 24px', background: yellow, color: '#000', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: '16px' }
  const backStyle: any = { background: 'none', border: 'none', color: '#888', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '16px' }
  const inputStyle: any = { width: '100%', padding: '9px 12px', background: '#111', border: '1px solid ' + border, borderRadius: '6px', color: '#fff', fontSize: '14px', fontFamily: 'sans-serif', boxSizing: 'border-box', outline: 'none' }
  const labelStyle: any = { fontSize: '11px', fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }

  if (step === 'service') return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '22px', color: yellow, fontStyle: 'italic' }}>BigBoss Electric</span>
        <span style={{ fontSize: '12px', color: '#888' }}>Everything is no problem.</span>
      </div>
      <div style={wrapStyle}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', marginBottom: '8px', color: yellow, fontStyle: 'italic' }}>What do you need?</h2>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>Select a service to get started</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {services.map(sv => (
            <button key={sv.id} onClick={() => { setSelectedService(sv); setStep('datetime') }}
              style={{ background: card, border: '1px solid ' + border, borderRadius: '8px', padding: '16px 18px', textAlign: 'left', cursor: 'pointer', color: '#fff' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = yellow}
              onMouseLeave={e => e.currentTarget.style.borderColor = border}>
              <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>{sv.name}</div>
              <div style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>{sv.description}</div>
              <div style={{ fontSize: '12px', color: yellow }}>{formatDuration(sv.duration_mins)} · {formatPrice(sv.price_cents)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  if (step === 'datetime') return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '22px', color: yellow, fontStyle: 'italic' }}>BigBoss Electric</span>
        <span style={{ fontSize: '12px', color: '#888' }}>Everything is no problem.</span>
      </div>
      <div style={wrapStyle}>
        <button style={backStyle} onClick={() => setStep('service')}>← Back</button>
        <div style={{ background: card, border: '1px solid ' + border, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid ' + border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'italic' }}>Choose a date</span>
            <span style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>Step 2 of 4</span>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '20px' }}>
              {getAvailableDates().map(d => {
                const label = (d.getMonth()+1) + '/' + d.getDate() + '/' + d.getFullYear()
                const isSel = selectedDate === label
                return (
                  <button key={label} onClick={() => setSelectedDate(label)}
                    style={{ padding: '8px 4px', border: '1.5px solid ' + (isSel ? yellow : border), borderRadius: '6px', background: isSel ? yellow : '#111', color: isSel ? '#000' : '#fff', cursor: 'pointer', fontSize: '11px' }}>
                    <div style={{ fontSize: '9px', opacity: 0.7 }}>{['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()]}</div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{d.getDate()}</div>
                    <div style={{ fontSize: '9px', opacity: 0.7 }}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}</div>
                  </button>
                )
              })}
            </div>
            {selectedDate && (
              <>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Available times</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {getTimeSlots().map(t => (
                    <button key={t} onClick={() => setSelectedTime(t)}
                      style={{ padding: '9px', border: '1.5px solid ' + (selectedTime === t ? yellow : border), borderRadius: '6px', background: selectedTime === t ? yellow : '#111', color: selectedTime === t ? '#000' : '#fff', cursor: 'pointer', fontSize: '12px', fontFamily: 'monospace', fontWeight: selectedTime === t ? 700 : 400 }}>
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button style={{ ...btnStyle, opacity: selectedDate && selectedTime ? 1 : 0.4 }}
              disabled={!selectedDate || !selectedTime}
              onClick={() => setStep('details')}>
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (step === 'details') return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '22px', color: yellow, fontStyle: 'italic' }}>BigBoss Electric</span>
        <span style={{ fontSize: '12px', color: '#888' }}>Everything is no problem.</span>
      </div>
      <div style={wrapStyle}>
        <button style={backStyle} onClick={() => setStep('datetime')}>← Back</button>
        <div style={{ background: card, border: '1px solid ' + border, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid ' + border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'italic' }}>Your details</span>
            <span style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>Step 3 of 4</span>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>First name</label>
                <input style={inputStyle} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
                {errors.first_name && <div style={{ fontSize: '11px', color: yellow, marginTop: '3px' }}>{errors.first_name}</div>}
              </div>
              <div>
                <label style={labelStyle}>Last name</label>
                <input style={inputStyle} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
                {errors.last_name && <div style={{ fontSize: '11px', color: yellow, marginTop: '3px' }}>{errors.last_name}</div>}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" />
              {errors.phone && <div style={{ fontSize: '11px', color: yellow, marginTop: '3px' }}>{errors.phone}</div>}
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@email.com" />
              {errors.email && <div style={{ fontSize: '11px', color: yellow, marginTop: '3px' }}>{errors.email}</div>}
            </div>
            <div>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anything we should know? e.g. panel location, parking, access instructions" />
            </div>
            <button style={btnStyle} onClick={() => { if (validate()) setStep('confirm') }}>
              Review booking
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (step === 'confirm') return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '22px', color: yellow, fontStyle: 'italic' }}>BigBoss Electric</span>
        <span style={{ fontSize: '12px', color: '#888' }}>Everything is no problem.</span>
      </div>
      <div style={wrapStyle}>
        <button style={backStyle} onClick={() => setStep('details')}>← Back</button>
        <div style={{ background: card, border: '1px solid ' + border, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid ' + border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'italic' }}>Confirm booking</span>
            <span style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>Step 4 of 4</span>
          </div>
          <div style={{ padding: '20px' }}>
            {[
              { label: 'Service',  value: selectedService?.name },
              { label: 'Date',     value: selectedDate },
              { label: 'Time',     value: selectedTime },
              { label: 'Duration', value: formatDuration(selectedService?.duration_mins ?? 0) },
              { label: 'Price',    value: formatPrice(selectedService?.price_cents ?? null) },
              { label: 'Name',     value: form.first_name + ' ' + form.last_name },
              { label: 'Phone',    value: form.phone },
              { label: 'Email',    value: form.email },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid ' + border }}>
                <span style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.label}</span>
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}
            <button style={{ ...btnStyle, opacity: submitting ? 0.6 : 1 }} disabled={submitting} onClick={submitBooking}>
              {submitting ? 'Booking...' : 'Confirm with BigBoss Electric'}
            </button>
            <p style={{ fontSize: '11px', color: '#555', textAlign: 'center', marginTop: '12px' }}>
              A team member will confirm your appointment shortly.
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '22px', color: yellow, fontStyle: 'italic' }}>BigBoss Electric</span>
        <span style={{ fontSize: '12px', color: '#888' }}>Everything is no problem.</span>
      </div>
      <div style={{ ...wrapStyle, textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', background: yellow, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '40px auto 20px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', color: yellow, fontStyle: 'italic', marginBottom: '12px' }}>You're booked!</h2>
        <p style={{ color: '#888', fontSize: '14px', lineHeight: 1.7, marginBottom: '8px' }}>
          {selectedService?.name} on {selectedDate} at {selectedTime}
        </p>
        <p style={{ color: '#555', fontSize: '13px', marginBottom: '24px' }}>
          We'll call you at {form.phone} to confirm.
        </p>
        <div style={{ background: card, border: '1px solid ' + border, borderRadius: '6px', padding: '12px 20px', display: 'inline-block' }}>
          <span style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>Booking ref: </span>
          <span style={{ fontSize: '13px', color: yellow, fontFamily: 'monospace', fontWeight: 600 }}>{bookingId}</span>
        </div>
      </div>
    </div>
  )
}
