'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useTenant } from '@/lib/tenant-context'
import { useThemeTokens } from '@/lib/theme'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DURATION_OPTIONS = [
  { label:'30 min',   value:30  },
  { label:'45 min',   value:45  },
  { label:'1 hour',   value:60  },
  { label:'1.5 hours',value:90  },
  { label:'2 hours',  value:120 },
  { label:'3 hours',  value:180 },
  { label:'4 hours',  value:240 },
  { label:'Half day', value:360 },
  { label:'Full day', value:480 },
]

type Service = {
  id:            string
  name:          string
  description:   string | null
  duration_mins: number
  price_cents:   number | null
  is_active:     boolean
  display_order: number
}

const EMPTY_FORM = {
  name:          '',
  description:   '',
  duration_mins: 60,
  price_cents:   null as number | null,
  call_for_price: false,
  price_input:   '',
}

export default function ServicesPage() {
  const { tenant } = useTenant()
  const T = useThemeTokens()

  const [services, setServices]   = useState<Service[]>([])
  const [fetched, setFetched]     = useState(false)
  const [selected, setSelected]   = useState<Service | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [isNew, setIsNew]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)

  const MAX_STORED = 20
  const MAX_ACTIVE = 10 // pro plan; free would be 5

  useEffect(() => {
    if (!tenant?.id) return
    loadServices()
  }, [tenant?.id])

  async function loadServices() {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('tenant_id', tenant!.id)
      .order('display_order')
      .order('created_at')
    setServices(data ?? [])
    setFetched(true)
  }

  function openNew() {
    setForm(EMPTY_FORM)
    setSelected(null)
    setIsNew(true)
    setShowForm(true)
    setConfirmDelete(false)
  }

  function openEdit(s: Service) {
    setSelected(s)
    setIsNew(false)
    setShowForm(true)
    setConfirmDelete(false)
    setForm({
      name:           s.name,
      description:    s.description ?? '',
      duration_mins:  s.duration_mins,
      price_cents:    s.price_cents,
      call_for_price: s.price_cents === null,
      price_input:    s.price_cents ? String(s.price_cents / 100) : '',
    })
  }

  function updateForm(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)

    const price = form.call_for_price ? null : (form.price_input ? Math.round(parseFloat(form.price_input) * 100) : null)
    const activeCount = services.filter(s => s.is_active).length

    if (isNew) {
      const nextOrder = services.length > 0 ? Math.max(...services.map(s => s.display_order)) + 1 : 1
      await supabase.from('services').insert({
        tenant_id:     tenant!.id,
        name:          form.name.trim(),
        description:   form.description.trim() || null,
        duration_mins: form.duration_mins,
        price_cents:   price,
        is_active:     activeCount < MAX_ACTIVE,
        display_order: nextOrder,
      })
    } else if (selected) {
      await supabase.from('services').update({
        name:          form.name.trim(),
        description:   form.description.trim() || null,
        duration_mins: form.duration_mins,
        price_cents:   price,
      }).eq('id', selected.id)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    await loadServices()
    if (isNew) setShowForm(false)
  }

  async function toggleActive(s: Service) {
    const activeCount = services.filter(sv => sv.is_active).length
    if (!s.is_active && activeCount >= MAX_ACTIVE) {
      alert(`You can only have ${MAX_ACTIVE} active services. Deactivate one first.`)
      return
    }
    await supabase.from('services').update({ is_active: !s.is_active }).eq('id', s.id)
    loadServices()
    if (selected?.id === s.id) setSelected({ ...s, is_active: !s.is_active })
  }

  async function moveOrder(s: Service, dir: 'up' | 'down') {
    const idx = services.findIndex(sv => sv.id === s.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= services.length) return
    const other = services[swapIdx]
    await Promise.all([
      supabase.from('services').update({ display_order: other.display_order }).eq('id', s.id),
      supabase.from('services').update({ display_order: s.display_order }).eq('id', other.id),
    ])
    loadServices()
  }

  async function deleteService() {
    if (!selected) return
    setDeleting(true)
    await supabase.from('services').delete().eq('id', selected.id)
    setDeleting(false)
    setShowForm(false)
    setSelected(null)
    setConfirmDelete(false)
    loadServices()
  }

  function formatDuration(mins: number) {
    const opt = DURATION_OPTIONS.find(o => o.value === mins)
    if (opt) return opt.label
    if (mins < 60) return `${mins} min`
    const h = Math.floor(mins / 60), m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  function formatPrice(cents: number | null) {
    if (cents === null) return 'Call for price'
    return '$' + (cents / 100).toFixed(0)
  }

  const active   = services.filter(s => s.is_active)
  const inactive = services.filter(s => !s.is_active)
  const canAddMore = services.length < MAX_STORED

  const inp: any = { width:'100%', padding:'9px 11px', border:`1px solid ${T.inputBorder}`, borderRadius:'6px', fontSize:'13px', fontFamily:'sans-serif', color:T.t1, background:T.input, outline:'none', boxSizing:'border-box', transition:'background 0.2s, color 0.2s' }
  const lbl: any = { fontSize:'11px', fontWeight:500, color:T.t3, textTransform:'uppercase' as any, letterSpacing:'0.06em', display:'block', marginBottom:'5px' }

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
        .svc-layout { display:flex; flex:1; overflow:hidden; min-height:calc(100vh - 120px); }
        .svc-list { width:300px; flex-shrink:0; display:flex; flex-direction:column; }
        .svc-detail { flex:1; overflow-y:auto; }
        .mob-form-back { display:none !important; }
        @media (max-width:768px) {
          .svc-list { width:100% !important; border-right:none !important; }
          .svc-detail { display:none !important; }
          .svc-detail.show { display:block !important; position:fixed !important; inset:0 !important; z-index:20 !important; overflow-y:auto !important; padding-top:52px !important; background:${T.bg} !important; }
          .mob-form-back { display:flex !important; }
        }
      `}</style>

      <div style={{ minHeight:'100vh', background:T.bg, fontFamily:'sans-serif', display:'flex', flexDirection:'column', transition:'background 0.2s' }}>

        {/* Header */}
        <div style={{ padding:'20px 20px 0', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', marginBottom:'4px' }}>
            <div>
              <h1 style={{ fontFamily:'Georgia,serif', fontSize:'22px', fontStyle:'italic', color:T.t1, marginBottom:'4px' }}>Services</h1>
              <p style={{ fontSize:'13px', color:T.t3 }}>
                {fetched ? `${active.length}/${MAX_ACTIVE} active · ${services.length}/${MAX_STORED} stored` : 'Loading...'}
              </p>
            </div>
            {canAddMore && (
              <button onClick={openNew}
                style={{ padding:'8px 18px', background:T.isDark?'#F4C300':'#1a1917', color:T.isDark?'#000':'#fff', border:'none', borderRadius:'6px', fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'sans-serif' }}>
                + Add service
              </button>
            )}
          </div>

          {/* Capacity bar */}
          {fetched && (
            <div style={{ marginTop:'12px', marginBottom:'4px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:T.t3, marginBottom:'4px' }}>
                <span>Active services</span>
                <span>{active.length}/{MAX_ACTIVE}</span>
              </div>
              <div style={{ height:'4px', background:T.border, borderRadius:'2px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${(active.length/MAX_ACTIVE)*100}%`, background: active.length >= MAX_ACTIVE ? '#E07B2A' : '#1a6b4a', borderRadius:'2px', transition:'width 0.3s' }} />
              </div>
            </div>
          )}
        </div>

        <div className="svc-layout" style={{ marginTop:'16px' }}>

          {/* Left: service list */}
          <div className="svc-list" style={{ borderRight:`1px solid ${T.border}`, background:T.card, transition:'background 0.2s' }}>
            <div style={{ flex:1, overflowY:'auto' }}>
              {!fetched ? (
                [1,2,3,4,5].map(i => (
                  <div key={i} style={{ padding:'14px 16px', borderBottom:`1px solid ${T.divider}` }}>
                    <div style={{ width:'140px', height:'13px', background:T.isDark?'#222':'#f0ede6', borderRadius:'4px', marginBottom:'6px', animation:'pulse 1.5s ease infinite' }} />
                    <div style={{ width:'80px', height:'11px', background:T.isDark?'#1e1e1e':'#f5f2ee', borderRadius:'4px', animation:'pulse 1.5s ease infinite' }} />
                  </div>
                ))
              ) : services.length === 0 ? (
                <div style={{ padding:'40px', textAlign:'center', color:T.t3, fontSize:'13px' }}>
                  No services yet — add your first one
                </div>
              ) : (
                <>
                  {/* Active services */}
                  {active.length > 0 && (
                    <>
                      <div style={{ padding:'8px 16px 4px', fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:T.t3 }}>
                        Active ({active.length})
                      </div>
                      {active.map((s, i) => (
                        <div key={s.id} onClick={() => { openEdit(s); setShowForm(true) }}
                          style={{ padding:'12px 16px', borderBottom:`1px solid ${T.divider}`, cursor:'pointer', background:selected?.id===s.id?T.hover:'transparent', transition:'background 0.1s' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight:600, fontSize:'14px', color:T.t1, marginBottom:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.name}</div>
                              <div style={{ fontSize:'12px', color:T.t3 }}>
                                {formatDuration(s.duration_mins)} · {formatPrice(s.price_cents)}
                              </div>
                            </div>
                            <div style={{ display:'flex', flexDirection:'column', gap:'2px', flexShrink:0 }}>
                              <button onClick={e => { e.stopPropagation(); moveOrder(s, 'up') }} disabled={i===0}
                                style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:'4px', width:'22px', height:'18px', cursor:i===0?'not-allowed':'pointer', color:T.t3, fontSize:'10px', display:'flex', alignItems:'center', justifyContent:'center', opacity:i===0?0.3:1 }}>▲</button>
                              <button onClick={e => { e.stopPropagation(); moveOrder(s, 'down') }} disabled={i===active.length-1}
                                style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:'4px', width:'22px', height:'18px', cursor:i===active.length-1?'not-allowed':'pointer', color:T.t3, fontSize:'10px', display:'flex', alignItems:'center', justifyContent:'center', opacity:i===active.length-1?0.3:1 }}>▼</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Inactive services */}
                  {inactive.length > 0 && (
                    <>
                      <div style={{ padding:'8px 16px 4px', fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:T.t3, marginTop:'4px' }}>
                        Inactive ({inactive.length})
                      </div>
                      {inactive.map(s => (
                        <div key={s.id} onClick={() => { openEdit(s); setShowForm(true) }}
                          style={{ padding:'12px 16px', borderBottom:`1px solid ${T.divider}`, cursor:'pointer', background:selected?.id===s.id?T.hover:'transparent', opacity:0.6, transition:'background 0.1s' }}>
                          <div style={{ fontWeight:500, fontSize:'14px', color:T.t2, marginBottom:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.name}</div>
                          <div style={{ fontSize:'12px', color:T.t3 }}>{formatDuration(s.duration_mins)} · {formatPrice(s.price_cents)}</div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: edit form */}
          <div className={`svc-detail${showForm?' show':''}`} style={{ background:T.bg }}>

            {/* Mobile back */}
            <button className="mob-form-back" onClick={() => setShowForm(false)}
              style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:'none', color:T.t3, fontSize:'13px', cursor:'pointer', padding:'16px 20px 0', fontFamily:'sans-serif' }}>
              ← All services
            </button>

            {!showForm ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:T.t3, fontSize:'14px', fontStyle:'italic', fontFamily:'Georgia,serif' }}>
                Select a service to edit, or add a new one
              </div>
            ) : (
              <div style={{ padding:'20px', maxWidth:'540px' }}>

                {/* Form header */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
                  <h2 style={{ fontFamily:'Georgia,serif', fontSize:'18px', fontStyle:'italic', color:T.t1 }}>
                    {isNew ? 'New service' : 'Edit service'}
                  </h2>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    {!isNew && selected && (
                      <button onClick={() => toggleActive(selected)}
                        style={{ padding:'6px 14px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:'6px', fontSize:'12px', fontWeight:500, cursor:'pointer', fontFamily:'sans-serif', color: selected.is_active ? '#9a5c10' : '#1a6b4a' }}>
                        {selected.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                    {saved && <span style={{ fontSize:'13px', color:'#1a6b4a' }}>✓ Saved</span>}
                    <button onClick={save} disabled={saving || !form.name.trim()}
                      style={{ padding:'7px 18px', background:T.isDark?'#F4C300':'#1a1917', color:T.isDark?'#000':'#fff', border:'none', borderRadius:'6px', fontSize:'13px', fontWeight:600, cursor:saving?'not-allowed':'pointer', opacity:saving||!form.name.trim()?0.5:1, fontFamily:'sans-serif' }}>
                      {saving ? 'Saving...' : isNew ? 'Add service' : 'Save changes'}
                    </button>
                  </div>
                </div>

                {/* Form fields */}
                <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

                  <div>
                    <label style={lbl}>Service name *</label>
                    <input style={inp} value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="e.g. Panel Upgrade" />
                  </div>

                  <div>
                    <label style={lbl}>Description</label>
                    <textarea
                      value={form.description}
                      onChange={e => updateForm('description', e.target.value)}
                      placeholder="Brief description shown to customers on the booking page"
                      rows={3}
                      style={{ ...inp, resize:'vertical', minHeight:'80px' }} />
                  </div>

                  <div>
                    <label style={lbl}>Duration</label>
                    <select style={inp} value={form.duration_mins} onChange={e => updateForm('duration_mins', parseInt(e.target.value))}>
                      {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={lbl}>Pricing</label>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                      <div onClick={() => updateForm('call_for_price', !form.call_for_price)}
                        style={{ width:'36px', height:'20px', borderRadius:'10px', background:form.call_for_price?'#1a6b4a':T.border, cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
                        <div style={{ position:'absolute', top:'2px', left:form.call_for_price?'18px':'2px', width:'16px', height:'16px', borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
                      </div>
                      <span style={{ fontSize:'13px', color:T.t1 }}>Call for price / Get a quote</span>
                    </div>
                    {!form.call_for_price && (
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ fontSize:'16px', color:T.t2, fontWeight:500 }}>$</span>
                        <input
                          type="number"
                          value={form.price_input}
                          onChange={e => updateForm('price_input', e.target.value)}
                          placeholder="0"
                          min="0"
                          step="1"
                          style={{ ...inp, flex:1 }} />
                      </div>
                    )}
                  </div>

                  {/* Preview */}
                  <div style={{ background:T.isDark?'#0a0a0a':'#f8f6f1', border:`1px solid ${T.border}`, borderRadius:'8px', padding:'14px', marginTop:'4px' }}>
                    <div style={{ fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:T.t3, marginBottom:'10px' }}>Booking page preview</div>
                    <div style={{ background:T.isDark?'#111':'#fff', border:`1px solid ${T.isDark?'#222':T.border}`, borderRadius:'8px', padding:'14px', position:'relative', overflow:'hidden' }}>
                      <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'#F4C300' }} />
                      <div style={{ fontSize:'22px', marginBottom:'6px' }}>⚡</div>
                      <div style={{ fontWeight:700, fontSize:'14px', color:T.t1, marginBottom:'4px' }}>
                        {form.name || 'Service name'}
                      </div>
                      <div style={{ fontSize:'12px', color:T.t3, lineHeight:1.4, marginBottom:'10px' }}>
                        {form.description || 'Your description will appear here'}
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:'11px', color:T.isDark?'#444':'#c8c4bc' }}>
                          {formatDuration(form.duration_mins)}
                        </span>
                        <span style={{ fontSize:'13px', color:'#F4C300', fontWeight:700 }}>
                          {form.call_for_price ? 'Call for price' : form.price_input ? '$'+form.price_input : 'Call for price'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Delete */}
                  {!isNew && (
                    <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:'16px', marginTop:'4px' }}>
                      <div style={{ fontSize:'11px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', color:T.t3, marginBottom:'8px' }}>Danger zone</div>
                      {!confirmDelete ? (
                        <button onClick={() => setConfirmDelete(true)}
                          style={{ padding:'8px 16px', background:'transparent', color:'#8c2820', border:'1px solid #8c282044', borderRadius:'6px', fontSize:'13px', cursor:'pointer', fontFamily:'sans-serif' }}>
                          Delete service
                        </button>
                      ) : (
                        <div style={{ background:'#fdf0ef', border:'1px solid #8c282022', borderRadius:'8px', padding:'14px' }}>
                          <p style={{ fontSize:'13px', color:'#8c2820', marginBottom:'12px' }}>
                            Are you sure? This cannot be undone. Any existing bookings for this service will remain.
                          </p>
                          <div style={{ display:'flex', gap:'8px' }}>
                            <button onClick={deleteService} disabled={deleting}
                              style={{ padding:'7px 16px', background:'#8c2820', color:'#fff', border:'none', borderRadius:'6px', fontSize:'13px', fontWeight:500, cursor:'pointer', fontFamily:'sans-serif', opacity:deleting?0.6:1 }}>
                              {deleting ? 'Deleting...' : 'Yes, delete'}
                            </button>
                            <button onClick={() => setConfirmDelete(false)}
                              style={{ padding:'7px 14px', background:'transparent', color:'#8c2820', border:'1px solid #8c282044', borderRadius:'6px', fontSize:'13px', cursor:'pointer', fontFamily:'sans-serif' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
