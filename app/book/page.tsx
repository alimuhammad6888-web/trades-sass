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
  const [step, setStep]                       = useState<Step>('service')
  const [services, setServices]               = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate]       = useState('')
  const [selectedTime, setSelectedTime]       = useState('')
  const [form, setForm]                       = useState({ first_name: '', last_name: '', phone: '', email: '', notes: '' })
  const [errors, setErrors]                   = useState<any>({})
  const [submitting, setSubmitting]           = useState(false)
  const [bookingId, setBookingId]             = useState('')

  useEffect(() => {
    supabase.from('services').select('*')
      .eq('tenant_id', TENANT_ID).eq('is_active', true).order('display_order')
      .then(({ data }) => setServices(data ?? []))
  }, [])

  const Y = '#F4C300'

  function formatPrice(cents: number | null) {
    return cents ? '$' + (cents / 100).toFixed(0) : 'Quote'
  }
  function formatDuration(mins: number) {
    if (mins < 60) return mins + 'min'
    const h = Math.floor(mins / 60), m = mins % 60
    return m > 0 ? h + 'h ' + m + 'm' : h + 'h'
  }
  function getAvailableDates() {
    const dates = [], today = new Date()
    for (let i = 1; dates.length < 21; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      if (d.getDay() !== 0) dates.push(d)
    }
    return dates
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

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']
  const TIMES  = ['8:00 AM','9:00 AM','10:00 AM','11:00 AM','1:00 PM','2:00 PM','3:00 PM','4:00 PM']
  const stepLabels = ['Service','Date & Time','Details','Confirm']
  const stepIdx    = ['service','datetime','details','confirm'].indexOf(step)

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #0d0d0d; color: #fff; font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .book-wrap { min-height:100vh; display:flex; flex-direction:column; background:#0d0d0d; }
        .book-header { background:#111; border-bottom:2px solid ${Y}; padding:0 20px; height:52px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
        .progress-bar { height:2px; background:#1a1a1a; flex-shrink:0; }
        .progress-fill { height:100%; background:${Y}; transition:width 0.3s ease; }
        .step-labels { display:flex; background:#0a0a0a; border-bottom:1px solid #1a1a1a; flex-shrink:0; overflow-x:auto; }
        .step-label { flex:1; padding:10px 8px; text-align:center; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#333; white-space:nowrap; border-bottom:2px solid transparent; transition:color 0.2s; }
        .step-label.active { color:${Y}; border-bottom-color:${Y}; }
        .step-label.done { color:#555; }
        .book-main { flex:1; display:flex; overflow:hidden; }
        .book-sidebar { width:260px; flex-shrink:0; background:#0a0a0a; border-right:1px solid #1a1a1a; padding:28px 20px; display:flex; flex-direction:column; gap:16px; overflow-y:auto; }
        .book-content { flex:1; overflow-y:auto; padding:32px; }
        @media (max-width:767px) {
          .book-sidebar { display:none; }
          .book-main { flex-direction:column; }
          .book-content { padding:20px; }
          .step-labels { display:flex; }
        }
        @media (min-width:768px) { .step-labels { display:none; } }
        .service-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
        @media (max-width:400px) { .service-grid { grid-template-columns:1fr; } }
        .service-card { background:#111; border:1.5px solid #1e1e1e; border-radius:10px; padding:16px; cursor:pointer; transition:border-color 0.15s,background 0.15s; text-align:left; color:#fff; width:100%; }
        .service-card:hover { border-color:#333; background:#141414; }
        .service-card.sel { border-color:${Y}; background:${Y}11; }
        .date-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; }
        @media (max-width:380px) { .date-grid { grid-template-columns:repeat(5,1fr); } }
        .date-btn { aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; border:1px solid #1e1e1e; border-radius:8px; background:#111; color:#fff; cursor:pointer; transition:all 0.15s; padding:4px; width:100%; }
        .date-btn:hover { border-color:#333; background:#161616; }
        .date-btn.sel { border-color:${Y}; background:${Y}; color:#000; }
        .time-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
        @media (max-width:380px) { .time-grid { grid-template-columns:repeat(2,1fr); } }
        .time-btn { padding:11px 6px; border:1.5px solid #222; border-radius:6px; background:#111; color:#888; cursor:pointer; font-size:13px; font-family:'DM Sans',sans-serif; font-weight:500; transition:all 0.15s; text-align:center; width:100%; }
        .time-btn:hover { border-color:#444; color:#fff; }
        .time-btn.sel { border-color:${Y}; background:${Y}22; color:${Y}; }
        .field-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media (max-width:400px) { .field-row { grid-template-columns:1fr; } }
        .inp { width:100%; padding:11px 12px; background:#111; border:1px solid #222; border-radius:6px; color:#fff; font-size:15px; font-family:'DM Sans',sans-serif; outline:none; transition:border-color 0.15s; -webkit-appearance:none; }
        .inp:focus { border-color:#444; }
        .inp.err { border-color:${Y}55; }
        .confirm-row { display:flex; justify-content:space-between; align-items:center; padding:11px 0; border-bottom:1px solid #1a1a1a; gap:12px; }
        .confirm-row:last-child { border:none; }
        .btn-primary { width:100%; padding:14px; background:${Y}; color:#000; border:none; border-radius:6px; font-size:16px; font-weight:700; cursor:pointer; font-family:'Barlow Condensed',sans-serif; text-transform:uppercase; letter-spacing:0.1em; transition:opacity 0.15s; -webkit-appearance:none; }
        .btn-primary:hover:not(:disabled) { opacity:0.9; }
        .btn-primary:disabled { background:#1a1a1a; color:#333; cursor:not-allowed; }
        .btn-back { background:none; border:none; color:#555; font-size:13px; cursor:pointer; padding:0; margin-bottom:20px; font-family:'DM Sans',sans-serif; display:flex; align-items:center; gap:6px; }
        .section-title { font-family:'Barlow Condensed',sans-serif; font-size:28px; font-weight:800; text-transform:uppercase; margin-bottom:6px; }
        .section-sub { font-size:13px; color:#555; margin-bottom:20px; }
        .field-label { font-size:11px; color:#555; text-transform:uppercase; letter-spacing:0.08em; display:block; margin-bottom:6px; }
        .field-error { font-size:11px; color:${Y}; margin-top:4px; }
        .anim { animation:fadeUp 0.3s ease both; }
        .max-w { max-width:560px; }
      `}</style>

      <div className="book-wrap">
        <div className="book-header">
          <a href="/" style={{ fontFamily:'Barlow Condensed', fontSize:'20px', fontWeight:900, textTransform:'uppercase', color:Y, textDecoration:'none', letterSpacing:'0.05em' }}>
            BigBoss<span style={{ color:'#fff' }}>Electric</span>
          </a>
          <a href="tel:5554262622" style={{ fontSize:'13px', color:'#555', textDecoration:'none' }}>(555) 426-2622</a>
        </div>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: step === 'done' ? '100%' : `${((stepIdx+1)/4)*100}%` }} />
        </div>

        {step !== 'done' && (
          <div className="step-labels">
            {stepLabels.map((l,i) => (
              <div key={l} className={`step-label ${i===stepIdx?'active':i<stepIdx?'done':''}`}>
                {i < stepIdx ? '✓ ' : ''}{l}
              </div>
            ))}
          </div>
        )}

        <div className="book-main">
          {/* Sidebar (desktop only) */}
          <div className="book-sidebar">
            <div style={{ fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.12em', color:'#444', marginBottom:'8px' }}>Your booking</div>
            {[
              { label:'Service', value:selectedService?.name,                                        s:'service' },
              { label:'Date',    value:selectedDate||null,                                            s:'datetime' },
              { label:'Time',    value:selectedTime||null,                                            s:'datetime' },
              { label:'Name',    value:form.first_name?`${form.first_name} ${form.last_name}`:null,  s:'details' },
            ].map((item) => {
              const idx    = ['service','datetime','details','confirm'].indexOf(item.s)
              const isDone = idx < stepIdx
              const isAct  = idx === stepIdx
              return (
                <div key={item.label} style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
                  <div style={{ width:'18px', height:'18px', borderRadius:'50%', background:isDone?Y:isAct?Y+'33':'#1a1a1a', border:`1.5px solid ${isDone||isAct?Y:'#2a2a2a'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'2px' }}>
                    {isDone&&<svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div>
                    <div style={{ fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:isAct?Y:isDone?'#666':'#333', marginBottom:'2px' }}>{item.label}</div>
                    <div style={{ fontSize:'12px', color:isDone?'#bbb':'#fff' }}>{item.value??'—'}</div>
                    {isDone&&<button onClick={()=>setStep(item.s as Step)} style={{ fontSize:'10px', color:Y, background:'none', border:'none', cursor:'pointer', padding:0, marginTop:'2px', fontFamily:'DM Sans' }}>Edit</button>}
                  </div>
                </div>
              )
            })}
            {selectedService&&(
              <div style={{ marginTop:'auto', background:'#111', border:'1px solid #1e1e1e', borderRadius:'8px', padding:'14px' }}>
                <div style={{ fontSize:'9px', color:'#444', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px' }}>Selected</div>
                <div style={{ fontSize:'14px', fontWeight:700, color:'#fff', marginBottom:'4px' }}>{SERVICE_ICONS[selectedService.name]??'⚡'} {selectedService.name}</div>
                <div style={{ fontSize:'11px', color:'#555', marginBottom:'8px', lineHeight:1.4 }}>{selectedService.description}</div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'11px', color:'#444' }}>{formatDuration(selectedService.duration_mins)}</span>
                  <span style={{ fontSize:'13px', color:Y, fontWeight:700 }}>{formatPrice(selectedService.price_cents)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="book-content">

            {step==='done'&&(
              <div className="anim" style={{ textAlign:'center', paddingTop:'40px' }}>
                <div style={{ width:'72px', height:'72px', background:Y, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <h2 style={{ fontFamily:'Barlow Condensed', fontSize:'48px', fontWeight:900, textTransform:'uppercase', color:Y, lineHeight:0.9, marginBottom:'16px' }}>Booked!</h2>
                <p style={{ color:'#666', fontSize:'15px', lineHeight:1.7, marginBottom:'6px' }}>
                  <strong style={{ color:'#fff' }}>{selectedService?.name}</strong> on <strong style={{ color:'#fff' }}>{selectedDate}</strong> at <strong style={{ color:'#fff' }}>{selectedTime}</strong>
                </p>
                <p style={{ color:'#444', fontSize:'13px', marginBottom:'28px' }}>We'll call {form.phone} to confirm.</p>
                <div style={{ background:'#111', border:`1px solid ${Y}33`, borderRadius:'8px', padding:'14px 20px', display:'inline-block' }}>
                  <span style={{ fontSize:'11px', color:'#444', fontFamily:'monospace' }}>Ref: </span>
                  <span style={{ fontSize:'14px', color:Y, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.1em' }}>{bookingId}</span>
                </div>
              </div>
            )}

            {step==='service'&&(
              <div className="anim max-w">
                <div className="section-title">What do you need?</div>
                <div className="section-sub">Select a service to get started</div>
                <div className="service-grid">
                  {services.map(sv=>(
                    <button key={sv.id} className={`service-card ${selectedService?.id===sv.id?'sel':''}`}
                      onClick={()=>{ setSelectedService(sv); setStep('datetime') }}>
                      <div style={{ fontSize:'24px', marginBottom:'8px' }}>{SERVICE_ICONS[sv.name]??'⚡'}</div>
                      <div style={{ fontWeight:700, fontSize:'14px', marginBottom:'4px' }}>{sv.name}</div>
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

            {step==='datetime'&&(
              <div className="anim max-w">
                <button className="btn-back" onClick={()=>setStep('service')}>← Back</button>
                <div className="section-title">Pick a date</div>
                <div className="section-sub">{selectedService?.name} · {formatDuration(selectedService?.duration_mins??0)}</div>
                <div className="date-grid" style={{ marginBottom:'24px' }}>
                  {getAvailableDates().map(d=>{
                    const label=(d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear()
                    const isSel=selectedDate===label
                    return(
                      <button key={label} className={`date-btn ${isSel?'sel':''}`}
                        onClick={()=>{ setSelectedDate(label); setSelectedTime('') }}>
                        <span style={{ fontSize:'9px', opacity:0.6, fontWeight:500 }}>{DAYS[d.getDay()]}</span>
                        <span style={{ fontSize:'15px', fontWeight:700, lineHeight:1 }}>{d.getDate()}</span>
                        <span style={{ fontSize:'9px', opacity:0.5 }}>{MONTHS[d.getMonth()]}</span>
                      </button>
                    )
                  })}
                </div>
                {selectedDate&&(
                  <>
                    <div style={{ fontSize:'11px', color:'#444', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'10px' }}>Available times</div>
                    <div className="time-grid" style={{ marginBottom:'24px' }}>
                      {TIMES.map(t=>(
                        <button key={t} className={`time-btn ${selectedTime===t?'sel':''}`} onClick={()=>setSelectedTime(t)}>{t}</button>
                      ))}
                    </div>
                  </>
                )}
                <button className="btn-primary" disabled={!selectedDate||!selectedTime} onClick={()=>setStep('details')}>
                  Continue →
                </button>
              </div>
            )}

            {step==='details'&&(
              <div className="anim max-w">
                <button className="btn-back" onClick={()=>setStep('datetime')}>← Back</button>
                <div className="section-title">Your details</div>
                <div className="section-sub">{selectedDate} at {selectedTime}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                  <div className="field-row">
                    <div>
                      <label className="field-label">First name</label>
                      <input className={`inp ${errors.first_name?'err':''}`} value={form.first_name} onChange={e=>{ setForm(f=>({...f,first_name:e.target.value})); setErrors((e2:any)=>({...e2,first_name:null})) }} />
                      {errors.first_name&&<div className="field-error">{errors.first_name}</div>}
                    </div>
                    <div>
                      <label className="field-label">Last name</label>
                      <input className={`inp ${errors.last_name?'err':''}`} value={form.last_name} onChange={e=>{ setForm(f=>({...f,last_name:e.target.value})); setErrors((e2:any)=>({...e2,last_name:null})) }} />
                      {errors.last_name&&<div className="field-error">{errors.last_name}</div>}
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Phone</label>
                    <input className={`inp ${errors.phone?'err':''}`} type="tel" value={form.phone} placeholder="(555) 000-0000" onChange={e=>{ setForm(f=>({...f,phone:e.target.value})); setErrors((e2:any)=>({...e2,phone:null})) }} />
                    {errors.phone&&<div className="field-error">{errors.phone}</div>}
                  </div>
                  <div>
                    <label className="field-label">Email</label>
                    <input className={`inp ${errors.email?'err':''}`} type="email" value={form.email} placeholder="you@email.com" onChange={e=>{ setForm(f=>({...f,email:e.target.value})); setErrors((e2:any)=>({...e2,email:null})) }} />
                    {errors.email&&<div className="field-error">{errors.email}</div>}
                  </div>
                  <div>
                    <label className="field-label">Notes <span style={{ color:'#333', textTransform:'none' }}>(optional)</span></label>
                    <textarea className="inp" rows={3} value={form.notes} placeholder="Panel location, parking, access instructions..." onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{ resize:'vertical', minHeight:'80px' }} />
                  </div>
                  <button className="btn-primary" onClick={()=>{ if(validate()) setStep('confirm') }}>Review booking →</button>
                </div>
              </div>
            )}

            {step==='confirm'&&(
              <div className="anim max-w">
                <button className="btn-back" onClick={()=>setStep('details')}>← Back</button>
                <div className="section-title">Confirm booking</div>
                <div className="section-sub">Review before confirming</div>
                <div style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:'10px', padding:'20px', marginBottom:'20px' }}>
                  {[
                    { label:'Service',  value:selectedService?.name },
                    { label:'Date',     value:selectedDate },
                    { label:'Time',     value:selectedTime },
                    { label:'Duration', value:formatDuration(selectedService?.duration_mins??0) },
                    { label:'Price',    value:formatPrice(selectedService?.price_cents??null) },
                  ].map(row=>(
                    <div key={row.label} className="confirm-row">
                      <span style={{ fontSize:'11px', color:'#444', textTransform:'uppercase', letterSpacing:'0.06em', flexShrink:0 }}>{row.label}</span>
                      <span style={{ fontSize:'13px', color:'#fff', fontWeight:600, textAlign:'right' }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ height:'1px', background:'#1e1e1e', margin:'8px 0' }} />
                  {[
                    { label:'Name',  value:form.first_name+' '+form.last_name },
                    { label:'Phone', value:form.phone },
                    { label:'Email', value:form.email },
                  ].map(row=>(
                    <div key={row.label} className="confirm-row">
                      <span style={{ fontSize:'11px', color:'#444', textTransform:'uppercase', letterSpacing:'0.06em', flexShrink:0 }}>{row.label}</span>
                      <span style={{ fontSize:'13px', color:'#aaa', textAlign:'right', wordBreak:'break-all' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <button className="btn-primary" disabled={submitting} onClick={submitBooking}>
                  {submitting?'Booking...':'⚡ Confirm with BigBoss Electric'}
                </button>
                <p style={{ fontSize:'11px', color:'#333', textAlign:'center', marginTop:'10px' }}>
                  A team member will call to confirm your appointment
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
