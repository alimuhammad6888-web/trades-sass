'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TENANT_ID = '11111111-1111-1111-1111-111111111111'

const SERVICE_ICONS: Record<string, string> = {
  'Panel Upgrade':       '⚡',
  'EV Charger Install':  '🔌',
  'Ceiling Fan Install': '💨',
  'Breaker Replacement': '🔧',
  'Outlet Installation': '🔲',
  'Lighting Install':    '💡',
  'Safety Inspection':   '🛡',
  'Emergency Service':   '🚨',
}

type Service = { id: string; name: string; description: string; duration_mins: number; price_cents: number | null }
type Step = 'service' | 'datetime' | 'details' | 'confirm' | 'done'

export default function BookPage() {
  const [step, setStep]                   = useState<Step>('service')
  const [services, setServices]           = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate]   = useState('')
  const [selectedTime, setSelectedTime]   = useState('')
  const [form, setForm]                   = useState({ first_name: '', last_name: '', phone: '', email: '', notes: '' })
  const [errors, setErrors]               = useState<any>({})
  const [submitting, setSubmitting]       = useState(false)
  const [bookingId, setBookingId]         = useState('')

  useEffect(() => {
    supabase.from('services').select('*').eq('tenant_id', TENANT_ID).eq('is_active', true).order('display_order')
      .then(({ data }) => setServices(data ?? []))
  }, [])

  const Y = '#F4C300'
  const D = '#0d0d0d'
  const C = '#1a1a1a'
  const B = '#222'

  function formatPrice(cents: number | null) {
    if (!cents) return 'Quote'
    return '$' + (cents / 100).toFixed(0)
  }
  function formatDuration(mins: number) {
    if (mins < 60) return mins + 'min'
    const h = Math.floor(mins / 60), m = mins % 60
    return m > 0 ? h + 'h ' + m + 'm' : h + 'h'
  }
  function getAvailableDates() {
    const dates = []
    const today = new Date()
    for (let i = 1; dates.length < 21; i++) {
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
    if (!form.last_name.trim())  e.last_name  = 'Required'
    if (!form.phone.trim())      e.phone      = 'Required'
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Valid email required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submitBooking() {
    if (!validate()) return
    setSubmitting(true)
    const { data: customer } = await supabase.from('customers').insert({
      tenant_id: TENANT_ID, first_name: form.first_name, last_name: form.last_name,
      phone: form.phone, email: form.email, lead_source: 'website',
    }).select('id').single() as any
    if (!customer) { setSubmitting(false); return }
    const timeMap: any = { '8:00 AM':'08:00','9:00 AM':'09:00','10:00 AM':'10:00','11:00 AM':'11:00','1:00 PM':'13:00','2:00 PM':'14:00','3:00 PM':'15:00','4:00 PM':'16:00' }
    const [month, day, year] = selectedDate.split('/')
    const starts = new Date(year + '-' + month.padStart(2,'0') + '-' + day.padStart(2,'0') + 'T' + timeMap[selectedTime] + ':00')
    const ends   = new Date(starts.getTime() + selectedService!.duration_mins * 60000)
    const { data: booking } = await supabase.from('bookings').insert({
      tenant_id: TENANT_ID, customer_id: customer.id, service_id: selectedService!.id,
      starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      price_cents: selectedService!.price_cents, notes: form.notes || null, status: 'pending',
    }).select('id').single() as any
    setBookingId(booking?.id?.slice(0,8).toUpperCase() ?? 'BBE00001')
    setSubmitting(false)
    setStep('done')
  }

  const pageStyle: any = { minHeight: '100vh', background: D, color: '#fff', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column' }

  // ── Shared header ────────────────────────────────────────────
  const Header = () => (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d0d0d; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .step-indicator { display:flex; gap:8px; align-items:center; }
        .step-dot { width:6px; height:6px; border-radius:50%; background:#2a2a2a; transition:background 0.2s; }
        .step-dot.active { background:${Y}; }
        .step-dot.done { background:#3a3a3a; }
        .time-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
        .time-btn { padding:10px 6px; border:1.5px solid #222; border-radius:6px; background:#111; color:#888; cursor:pointer; font-size:13px; font-family:'DM Sans',sans-serif; font-weight:500; transition:all 0.15s; text-align:center; }
        .time-btn:hover { border-color:#444; color:#fff; }
        .time-btn.sel { border-color:${Y}; background:${Y}22; color:${Y}; }
        .date-btn { aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; border:1px solid #1e1e1e; border-radius:8px; background:#111; color:#fff; cursor:pointer; transition:all 0.15s; padding:6px; }
        .date-btn:hover { border-color:#333; background:#161616; }
        .date-btn.sel { border-color:${Y}; background:${Y}; color:#000; }
        .inp { width:100%; padding:10px 12px; background:#111; border:1px solid #222; border-radius:6px; color:#fff; font-size:14px; font-family:'DM Sans',sans-serif; outline:none; transition:border-color 0.15s; }
        .inp:focus { border-color:#444; }
        .inp.err { border-color:${Y}44; }
        .confirm-row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #1a1a1a; }
        .confirm-row:last-child { border:none; }
      `}</style>
      <div style={{ background:'#111', borderBottom:`2px solid ${Y}`, padding:'0 24px', height:'52px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <a href="/" style={{ fontFamily:'Barlow Condensed', fontSize:'20px', fontWeight:900, textTransform:'uppercase', color:Y, textDecoration:'none', letterSpacing:'0.05em' }}>
          BigBoss<span style={{ color:'#fff' }}>Electric</span>
        </a>
        <a href="tel:5554262622" style={{ fontSize:'13px', color:'#555', textDecoration:'none' }}>(555) 426-2622</a>
      </div>
    </>
  )

  // ── DONE ─────────────────────────────────────────────────────
  if (step === 'done') return (
    <div style={pageStyle}>
      <Header />
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 20px' }}>
        <div style={{ textAlign:'center', maxWidth:'400px', animation:'fadeUp 0.4s ease both' }}>
          <div style={{ width:'72px', height:'72px', background:Y, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{ fontFamily:'Barlow Condensed', fontSize:'48px', fontWeight:900, textTransform:'uppercase', color:Y, lineHeight:0.9, marginBottom:'16px' }}>Booked!</h2>
          <p style={{ color:'#666', fontSize:'15px', lineHeight:1.7, marginBottom:'6px' }}>
            <strong style={{ color:'#fff' }}>{selectedService?.name}</strong> on <strong style={{ color:'#fff' }}>{selectedDate}</strong> at <strong style={{ color:'#fff' }}>{selectedTime}</strong>
          </p>
          <p style={{ color:'#444', fontSize:'13px', marginBottom:'28px' }}>We'll call {form.phone} to confirm your appointment.</p>
          <div style={{ background:'#111', border:`1px solid ${Y}33`, borderRadius:'8px', padding:'14px 20px', display:'inline-block' }}>
            <span style={{ fontSize:'11px', color:'#444', fontFamily:'monospace' }}>Booking ref: </span>
            <span style={{ fontSize:'14px', color:Y, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.1em' }}>{bookingId}</span>
          </div>
        </div>
      </div>
    </div>
  )

  // ── MAIN LAYOUT: left summary + right form ───────────────────
  const steps = ['service','datetime','details','confirm']
  const stepIdx = steps.indexOf(step)

  return (
    <div style={pageStyle}>
      <Header />

      {/* Progress bar */}
      <div style={{ height:'2px', background:'#1a1a1a', flexShrink:0 }}>
        <div style={{ height:'100%', background:Y, width:`${((stepIdx + 1) / 4) * 100}%`, transition:'width 0.3s ease' }} />
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* LEFT: Summary panel */}
        <div style={{ width:'280px', flexShrink:0, background:'#0a0a0a', borderRight:'1px solid #1a1a1a', padding:'28px 24px', display:'flex', flexDirection:'column', gap:'20px' }}>
          <div>
            <div style={{ fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.12em', color:'#444', marginBottom:'16px' }}>Your booking</div>

            {/* Steps */}
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              {[
                { label:'Service',   value: selectedService?.name ?? null,    step:'service' },
                { label:'Date',      value: selectedDate || null,              step:'datetime' },
                { label:'Time',      value: selectedTime || null,              step:'datetime' },
                { label:'Your info', value: form.first_name ? `${form.first_name} ${form.last_name}` : null, step:'details' },
              ].map((item, i) => {
                const isActive  = steps.indexOf(item.step as Step) === stepIdx
                const isDone    = steps.indexOf(item.step as Step) < stepIdx
                const isEditable = isDone
                return (
                  <div key={item.label} style={{ display:'flex', gap:'12px', alignItems:'flex-start' }}>
                    <div style={{ width:'20px', height:'20px', borderRadius:'50%', background: isDone ? Y : isActive ? Y+'33' : '#1a1a1a', border:`1.5px solid ${isDone || isActive ? Y : '#2a2a2a'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'1px' }}>
                      {isDone && <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color: isActive ? Y : isDone ? '#888' : '#333', marginBottom:'2px' }}>{item.label}</div>
                      {item.value ? (
                        <div style={{ fontSize:'13px', color: isDone ? '#ccc' : '#fff', fontWeight:500 }}>{item.value}</div>
                      ) : (
                        <div style={{ fontSize:'12px', color:'#2a2a2a' }}>—</div>
                      )}
                      {isEditable && (
                        <button onClick={() => setStep(item.step as Step)} style={{ fontSize:'10px', color:Y, background:'none', border:'none', cursor:'pointer', padding:0, marginTop:'3px', fontFamily:'DM Sans' }}>Edit</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected service detail */}
          {selectedService && (
            <div style={{ marginTop:'auto', background:'#111', border:'1px solid #1e1e1e', borderRadius:'8px', padding:'14px' }}>
              <div style={{ fontSize:'10px', color:'#444', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px' }}>Selected</div>
              <div style={{ fontSize:'14px', fontWeight:700, color:'#fff', marginBottom:'4px' }}>
                {SERVICE_ICONS[selectedService.name] ?? '⚡'} {selectedService.name}
              </div>
              <div style={{ fontSize:'12px', color:'#555', marginBottom:'8px' }}>{selectedService.description}</div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'12px', color:'#444' }}>{formatDuration(selectedService.duration_mins)}</span>
                <span style={{ fontSize:'13px', color:Y, fontWeight:700 }}>{formatPrice(selectedService.price_cents)}</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Active step */}
        <div style={{ flex:1, overflowY:'auto', padding:'32px', scrollbarWidth:'thin', scrollbarColor:'#222 transparent' }}>

          {/* ── SERVICE SELECTION ── */}
          {step === 'service' && (
            <div style={{ animation:'fadeUp 0.3s ease both', maxWidth:'640px' }}>
              <h2 style={{ fontFamily:'Barlow Condensed', fontSize:'32px', fontWeight:800, textTransform:'uppercase', marginBottom:'6px' }}>
                What do you need?
              </h2>
              <p style={{ fontSize:'13px', color:'#555', marginBottom:'24px' }}>Select a service to get started</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'10px' }}>
                {services.map(sv => (
                  <button key={sv.id}
                    onClick={() => { setSelectedService(sv); setStep('datetime') }}
                    style={{ background:'#111', border:`1.5px solid ${selectedService?.id === sv.id ? Y : '#1e1e1e'}`, borderRadius:'10px', padding:'18px', textAlign:'left', cursor:'pointer', color:'#fff', transition:'all 0.15s', position:'relative', overflow:'hidden' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.background = '#141414' }}
                    onMouseLeave={e => { if (selectedService?.id !== sv.id) { e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.background = '#111' } }}>
                    <div style={{ fontSize:'24px', marginBottom:'8px' }}>{SERVICE_ICONS[sv.name] ?? '⚡'}</div>
                    <div style={{ fontWeight:700, fontSize:'14px', marginBottom:'4px', color:'#fff' }}>{sv.name}</div>
                    <div style={{ fontSize:'11px', color:'#555', lineHeight:1.4, marginBottom:'10px' }}>{sv.description}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:'11px', color:'#333' }}>{formatDuration(sv.duration_mins)}</span>
                      <span style={{ fontSize:'13px', color:Y, fontWeight:700 }}>{formatPrice(sv.price_cents)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── DATE + TIME ── */}
          {step === 'datetime' && (
            <div style={{ animation:'fadeUp 0.3s ease both', maxWidth:'560px' }}>
              <button onClick={() => setStep('service')} style={{ background:'none', border:'none', color:'#555', fontSize:'13px', cursor:'pointer', padding:0, marginBottom:'20px', display:'flex', alignItems:'center', gap:'6px', fontFamily:'DM Sans' }}>
                ← Back
              </button>
              <h2 style={{ fontFamily:'Barlow Condensed', fontSize:'32px', fontWeight:800, textTransform:'uppercase', marginBottom:'24px' }}>
                Pick a date & time
              </h2>

              {/* Date grid — 7 per row */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:'6px', marginBottom:'28px' }}>
                {getAvailableDates().map(d => {
                  const label = (d.getMonth()+1) + '/' + d.getDate() + '/' + d.getFullYear()
                  const isSel = selectedDate === label
                  return (
                    <button key={label} onClick={() => { setSelectedDate(label); setSelectedTime('') }}
                      className={`date-btn${isSel ? ' sel' : ''}`}>
                      <span style={{ fontSize:'9px', opacity:0.6, fontWeight:500 }}>{['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()]}</span>
                      <span style={{ fontSize:'16px', fontWeight:700, lineHeight:1 }}>{d.getDate()}</span>
                      <span style={{ fontSize:'9px', opacity:0.5 }}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}</span>
                    </button>
                  )
                })}
              </div>

              {selectedDate && (
                <>
                  <div style={{ fontSize:'11px', color:'#444', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'10px' }}>Available times</div>
                  <div className="time-grid" style={{ marginBottom:'28px' }}>
                    {getTimeSlots().map(t => (
                      <button key={t} onClick={() => setSelectedTime(t)} className={`time-btn${selectedTime === t ? ' sel' : ''}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                disabled={!selectedDate || !selectedTime}
                onClick={() => setStep('details')}
                style={{ padding:'12px 32px', background: selectedDate && selectedTime ? Y : '#1a1a1a', color: selectedDate && selectedTime ? '#000' : '#333', border:'none', borderRadius:'6px', fontSize:'15px', fontWeight:700, cursor: selectedDate && selectedTime ? 'pointer' : 'not-allowed', fontFamily:'DM Sans', transition:'all 0.2s', fontFamily:'Barlow Condensed', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                Continue →
              </button>
            </div>
          )}

          {/* ── DETAILS ── */}
          {step === 'details' && (
            <div style={{ animation:'fadeUp 0.3s ease both', maxWidth:'480px' }}>
              <button onClick={() => setStep('datetime')} style={{ background:'none', border:'none', color:'#555', fontSize:'13px', cursor:'pointer', padding:0, marginBottom:'20px', fontFamily:'DM Sans' }}>← Back</button>
              <h2 style={{ fontFamily:'Barlow Condensed', fontSize:'32px', fontWeight:800, textTransform:'uppercase', marginBottom:'24px' }}>Your details</h2>

              <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'6px' }}>First name</label>
                    <input className={`inp${errors.first_name ? ' err' : ''}`} value={form.first_name} onChange={e => { setForm(f => ({...f, first_name:e.target.value})); setErrors((e2:any) => ({...e2, first_name:null})) }} />
                    {errors.first_name && <div style={{ fontSize:'11px', color:Y, marginTop:'4px' }}>{errors.first_name}</div>}
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'6px' }}>Last name</label>
                    <input className={`inp${errors.last_name ? ' err' : ''}`} value={form.last_name} onChange={e => { setForm(f => ({...f, last_name:e.target.value})); setErrors((e2:any) => ({...e2, last_name:null})) }} />
                    {errors.last_name && <div style={{ fontSize:'11px', color:Y, marginTop:'4px' }}>{errors.last_name}</div>}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'6px' }}>Phone</label>
                  <input className={`inp${errors.phone ? ' err' : ''}`} type="tel" value={form.phone} placeholder="(555) 000-0000" onChange={e => { setForm(f => ({...f, phone:e.target.value})); setErrors((e2:any) => ({...e2, phone:null})) }} />
                  {errors.phone && <div style={{ fontSize:'11px', color:Y, marginTop:'4px' }}>{errors.phone}</div>}
                </div>
                <div>
                  <label style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'6px' }}>Email</label>
                  <input className={`inp${errors.email ? ' err' : ''}`} type="email" value={form.email} placeholder="you@email.com" onChange={e => { setForm(f => ({...f, email:e.target.value})); setErrors((e2:any) => ({...e2, email:null})) }} />
                  {errors.email && <div style={{ fontSize:'11px', color:Y, marginTop:'4px' }}>{errors.email}</div>}
                </div>
                <div>
                  <label style={{ fontSize:'11px', color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'6px' }}>Notes <span style={{ color:'#333', textTransform:'none' }}>(optional)</span></label>
                  <textarea className="inp" rows={3} value={form.notes} placeholder="Panel location, parking instructions, anything we should know..." onChange={e => setForm(f => ({...f, notes:e.target.value}))} style={{ resize:'vertical', minHeight:'80px' }} />
                </div>

                <button onClick={() => { if (validate()) setStep('confirm') }}
                  style={{ padding:'12px 32px', background:Y, color:'#000', border:'none', borderRadius:'6px', fontSize:'15px', fontWeight:700, cursor:'pointer', fontFamily:'Barlow Condensed', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:'4px' }}>
                  Review booking →
                </button>
              </div>
            </div>
          )}

          {/* ── CONFIRM ── */}
          {step === 'confirm' && (
            <div style={{ animation:'fadeUp 0.3s ease both', maxWidth:'480px' }}>
              <button onClick={() => setStep('details')} style={{ background:'none', border:'none', color:'#555', fontSize:'13px', cursor:'pointer', padding:0, marginBottom:'20px', fontFamily:'DM Sans' }}>← Back</button>
              <h2 style={{ fontFamily:'Barlow Condensed', fontSize:'32px', fontWeight:800, textTransform:'uppercase', marginBottom:'24px' }}>Confirm booking</h2>

              <div style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:'10px', padding:'20px', marginBottom:'20px' }}>
                {[
                  { label:'Service',  value: selectedService?.name },
                  { label:'Date',     value: selectedDate },
                  { label:'Time',     value: selectedTime },
                  { label:'Duration', value: formatDuration(selectedService?.duration_mins ?? 0) },
                  { label:'Price',    value: formatPrice(selectedService?.price_cents ?? null) },
                ].map(row => (
                  <div key={row.label} className="confirm-row">
                    <span style={{ fontSize:'11px', color:'#444', textTransform:'uppercase', letterSpacing:'0.06em' }}>{row.label}</span>
                    <span style={{ fontSize:'13px', color:'#fff', fontWeight:600 }}>{row.value}</span>
                  </div>
                ))}
                <div style={{ height:'1px', background:'#1e1e1e', margin:'12px 0' }} />
                {[
                  { label:'Name',  value: form.first_name + ' ' + form.last_name },
                  { label:'Phone', value: form.phone },
                  { label:'Email', value: form.email },
                ].map(row => (
                  <div key={row.label} className="confirm-row">
                    <span style={{ fontSize:'11px', color:'#444', textTransform:'uppercase', letterSpacing:'0.06em' }}>{row.label}</span>
                    <span style={{ fontSize:'13px', color:'#ccc' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={submitBooking}
                disabled={submitting}
                style={{ width:'100%', padding:'14px', background: submitting ? '#1a1a1a' : Y, color: submitting ? '#444' : '#000', border:'none', borderRadius:'6px', fontSize:'16px', fontWeight:700, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily:'Barlow Condensed', textTransform:'uppercase', letterSpacing:'0.1em', transition:'all 0.2s' }}>
                {submitting ? 'Booking...' : '⚡ Confirm with BigBoss Electric'}
              </button>
              <p style={{ fontSize:'11px', color:'#333', textAlign:'center', marginTop:'10px' }}>
                A team member will call to confirm your appointment
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
