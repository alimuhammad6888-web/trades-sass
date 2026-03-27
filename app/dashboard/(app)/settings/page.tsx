'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useTenant } from '@/lib/tenant-context'
import { useThemeTokens } from '@/lib/theme'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PALETTES = [
  { label:'Electric', p:'#F4C300', a:'#1a1a1a' },
  { label:'Navy',     p:'#1C3D5A', a:'#3B82C4' },
  { label:'Forest',   p:'#1D4E35', a:'#34A668' },
  { label:'Slate',    p:'#334155', a:'#64748b' },
  { label:'Ruby',     p:'#8B1A1A', a:'#DC2626' },
  { label:'Midnight', p:'#1e1b4b', a:'#818cf8' },
]

export default function SettingsPage() {
  const { tenant } = useTenant()
  const T = useThemeTokens()
  const [fetched, setFetched] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [tab, setTab]         = useState('branding')
  const [bizName, setBizName] = useState('')
  const [form, setForm] = useState({
    primary_color:'#F4C300', accent_color:'#1a1a1a', tagline:'',
    phone:'', email:'', address_line1:'', city:'', state:'',
    border_radius:'soft', font_style:'sans', chatbot_greeting:'',
    booking_lead_time_hours:2, booking_window_days:60, auto_confirm_bookings:false,
  })

  useEffect(() => {
    if (!tenant?.id) return
    Promise.all([
      supabase.from('tenants').select('name').eq('id', tenant.id).single(),
      supabase.from('business_settings').select('*').eq('tenant_id', tenant.id).single(),
    ]).then(([tr, sr]) => {
      if (tr.data) setBizName(tr.data.name)
      if (sr.data) {
        const s = sr.data
        setForm(f => ({
          ...f,
          primary_color: s.primary_color ?? f.primary_color,
          accent_color:  s.accent_color  ?? f.accent_color,
          tagline:       s.tagline       ?? '',
          phone:         s.phone         ?? '',
          email:         s.email         ?? '',
          address_line1: s.address_line1 ?? '',
          city:          s.city          ?? '',
          state:         s.state         ?? '',
          border_radius: s.border_radius ?? 'soft',
          font_style:    s.font_style    ?? 'sans',
          chatbot_greeting:        s.chatbot_greeting        ?? '',
          booking_lead_time_hours: s.booking_lead_time_hours ?? 2,
          booking_window_days:     s.booking_window_days     ?? 60,
          auto_confirm_bookings:   s.auto_confirm_bookings   ?? false,
        }))
      }
      setFetched(true)
    })
  }, [tenant?.id])

  function update(key: string, value: any) { setForm(f => ({ ...f, [key]: value })) }

  async function save() {
    setSaving(true)
    await Promise.all([
      supabase.from('tenants').update({ name: bizName }).eq('id', tenant!.id),
      supabase.from('business_settings').update(form).eq('tenant_id', tenant!.id),
    ])
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const inp: any = { width:'100%', padding:'9px 11px', border:`1px solid ${T.inputBorder}`, borderRadius:'6px', fontSize:'13px', fontFamily:'sans-serif', color:T.t1, background:T.input, outline:'none', boxSizing:'border-box', transition:'background 0.2s, color 0.2s' }
  const lbl: any = { fontSize:'11px', fontWeight:500, color:T.t3, textTransform:'uppercase' as any, letterSpacing:'0.06em', display:'block', marginBottom:'5px' }
  const card: any = { background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'20px', marginBottom:'16px', transition:'background 0.2s' }
  const cardTitle: any = { fontFamily:'Georgia,serif', fontSize:'14px', fontStyle:'italic', color:T.t1, marginBottom:'16px', paddingBottom:'10px', borderBottom:`1px solid ${T.divider}` }

  const pp = form.primary_color
  const pr = ({ sharp:'0px', soft:'6px', round:'14px' } as any)[form.border_radius] ?? '6px'
  const pf = ({ sans:"'DM Sans',sans-serif", serif:'Georgia,serif', slab:'Rockwell,serif' } as any)[form.font_style] ?? 'sans-serif'

  return (
    <div style={{ minHeight:'100vh', background:T.bg, fontFamily:'sans-serif', transition:'background 0.2s' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
        .settings-grid { display:grid; grid-template-columns:1fr 300px; gap:20px; padding:20px; max-width:1000px; }
        @media (max-width:768px) { .settings-grid { grid-template-columns:1fr !important; } .preview-panel { display:none !important; } }
      `}</style>

      {/* Header */}
      <div style={{ padding:'20px 20px 0', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontFamily:'Georgia,serif', fontSize:'22px', fontStyle:'italic', color:T.t1, marginBottom:'4px' }}>Settings</h1>
          <p style={{ fontSize:'13px', color:T.t3 }}>Branding, contact info, and booking rules</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {saved && <span style={{ fontSize:'13px', color:'#1a6b4a' }}>✓ Saved</span>}
          <button onClick={save} disabled={saving || !fetched}
            style={{ padding:'8px 20px', background:T.isDark?'#F4C300':'#1a1917', color:T.isDark?'#000':'#fff', border:'none', borderRadius:'6px', fontSize:'13px', fontWeight:600, cursor:saving?'not-allowed':'pointer', opacity:saving||!fetched?0.5:1, fontFamily:'sans-serif' }}>
            {saving?'Saving...':'Save changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background:T.card, borderBottom:`1px solid ${T.border}`, padding:'0 20px', display:'flex', marginTop:'16px', transition:'background 0.2s' }}>
        {['branding','contact','booking'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'12px 16px', border:'none', borderBottom:`2px solid ${tab===t?T.t1:'transparent'}`, background:'transparent', fontSize:'13px', fontWeight:500, color:tab===t?T.t1:T.t3, cursor:'pointer', fontFamily:'sans-serif', textTransform:'capitalize' as any, transition:'color 0.2s' }}>
            {t}
          </button>
        ))}
      </div>

      {!fetched ? (
        <div style={{ padding:'20px' }}>
          {[1,2,3].map(i => <div key={i} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px', height:'120px', marginBottom:'16px', animation:'pulse 1.5s ease infinite' }} />)}
        </div>
      ) : (
        <div className="settings-grid">
          <div>
            {tab==='branding' && (
              <>
                <div style={card}>
                  <div style={cardTitle}>Business identity</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                    <div><label style={lbl}>Business name</label><input style={inp} value={bizName} onChange={e => setBizName(e.target.value)} /></div>
                    <div><label style={lbl}>Tagline</label><input style={inp} value={form.tagline} onChange={e => update('tagline', e.target.value)} placeholder="e.g. Everything is no problem." /></div>
                  </div>
                </div>

                <div style={card}>
                  <div style={cardTitle}>Colors</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
                    {[
                      { key:'primary_color', label:'Primary color' },
                      { key:'accent_color',  label:'Accent color' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={lbl}>{f.label}</label>
                        <div style={{ display:'flex', alignItems:'center', gap:'10px', border:`1px solid ${T.inputBorder}`, borderRadius:'6px', padding:'8px 12px', background:T.input }}>
                          <input type="color" value={(form as any)[f.key]} onChange={e => update(f.key, e.target.value)}
                            style={{ width:'40px', height:'30px', border:`1px solid ${T.border}`, borderRadius:'4px', cursor:'pointer', padding:'2px', background:'none' }} />
                          <span style={{ fontFamily:'monospace', fontSize:'12px', color:T.t1 }}>{(form as any)[f.key]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <label style={lbl}>Quick palettes</label>
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' as any }}>
                    {PALETTES.map(pal => (
                      <button key={pal.label} onClick={() => { update('primary_color', pal.p); update('accent_color', pal.a) }}
                        style={{ display:'flex', alignItems:'center', gap:'6px', padding:'5px 12px', border:`1.5px solid ${form.primary_color===pal.p?pal.p:T.border}`, borderRadius:'20px', background:form.primary_color===pal.p?pal.p+'22':T.card, cursor:'pointer', fontSize:'12px', fontWeight:500, fontFamily:'sans-serif', color:T.t1, transition:'all 0.15s' }}>
                        <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:pal.p }} />{pal.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={card}>
                  <div style={cardTitle}>Style</div>
                  <div style={{ marginBottom:'14px' }}>
                    <label style={lbl}>Corner style</label>
                    <div style={{ display:'flex', gap:'8px' }}>
                      {['sharp','soft','round'].map(r => (
                        <button key={r} onClick={() => update('border_radius', r)}
                          style={{ padding:'6px 16px', border:`1.5px solid ${form.border_radius===r?T.t1:T.border}`, borderRadius:r==='sharp'?'2px':r==='soft'?'6px':'20px', background:form.border_radius===r?T.t1:'transparent', color:form.border_radius===r?(T.isDark?'#000':'#fff'):T.t2, cursor:'pointer', fontSize:'12px', fontWeight:500, fontFamily:'sans-serif', transition:'all 0.15s' }}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Heading font</label>
                    <div style={{ display:'flex', gap:'8px' }}>
                      {[{key:'sans',label:'Sans',fam:'DM Sans,sans-serif'},{key:'serif',label:'Serif',fam:'Georgia,serif'},{key:'slab',label:'Slab',fam:'Rockwell,serif'}].map(f => (
                        <button key={f.key} onClick={() => update('font_style', f.key)}
                          style={{ padding:'6px 16px', border:`1.5px solid ${form.font_style===f.key?T.t1:T.border}`, borderRadius:'6px', background:form.font_style===f.key?T.t1:'transparent', color:form.font_style===f.key?(T.isDark?'#000':'#fff'):T.t2, cursor:'pointer', fontSize:'13px', fontWeight:500, fontFamily:f.fam, transition:'all 0.15s' }}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab==='contact' && (
              <div style={card}>
                <div style={cardTitle}>Contact information</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {[{key:'phone',label:'Phone',ph:'(555) 000-0000'},{key:'email',label:'Email',ph:'hello@yourbusiness.com'},{key:'address_line1',label:'Address',ph:'123 Main St'},{key:'city',label:'City',ph:'Los Angeles'},{key:'state',label:'State',ph:'CA'}].map(f => (
                    <div key={f.key}><label style={lbl}>{f.label}</label><input style={inp} value={(form as any)[f.key]} onChange={e => update(f.key, e.target.value)} placeholder={f.ph} /></div>
                  ))}
                </div>
              </div>
            )}

            {tab==='booking' && (
              <div style={card}>
                <div style={cardTitle}>Booking settings</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                  <div>
                    <label style={lbl}>Lead time (hours)</label>
                    <input style={inp} type="number" value={form.booking_lead_time_hours} onChange={e => update('booking_lead_time_hours', parseInt(e.target.value))} />
                    <div style={{ fontSize:'11px', color:T.t3, marginTop:'4px' }}>Minimum hours before a customer can book</div>
                  </div>
                  <div>
                    <label style={lbl}>Booking window (days)</label>
                    <input style={inp} type="number" value={form.booking_window_days} onChange={e => update('booking_window_days', parseInt(e.target.value))} />
                    <div style={{ fontSize:'11px', color:T.t3, marginTop:'4px' }}>How far ahead customers can book</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <input type="checkbox" id="autoconfirm" checked={form.auto_confirm_bookings} onChange={e => update('auto_confirm_bookings', e.target.checked)} style={{ width:'16px', height:'16px', accentColor:T.isDark?'#F4C300':'#1a1917' }} />
                    <label htmlFor="autoconfirm" style={{ fontSize:'13px', color:T.t1, cursor:'pointer' }}>Auto-confirm bookings</label>
                  </div>
                  <div>
                    <label style={lbl}>Chatbot greeting</label>
                    <input style={inp} value={form.chatbot_greeting} onChange={e => update('chatbot_greeting', e.target.value)} placeholder="Hi! How can I help you today?" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preview — hidden on mobile */}
          <div className="preview-panel">
            <div style={{ position:'sticky', top:'20px' }}>
              <div style={{ fontSize:'10px', fontWeight:500, textTransform:'uppercase' as any, letterSpacing:'0.07em', color:T.label, marginBottom:'10px' }}>Live preview</div>
              <div style={{ border:`1px solid ${T.border}`, borderRadius:'8px', overflow:'hidden' }}>
                <div style={{ background:'#111', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ color:pp, fontWeight:800, fontSize:'13px', textTransform:'uppercase' as any, fontFamily:pf }}>{bizName||'Your Business'}</span>
                  <span style={{ background:pp, color:'#000', padding:'4px 10px', borderRadius:pr, fontSize:'10px', fontWeight:700, textTransform:'uppercase' as any }}>Book now</span>
                </div>
                <div style={{ background:'#0d0d0d', padding:'20px 16px' }}>
                  <div style={{ fontSize:'26px', fontWeight:800, color:'#fff', textTransform:'uppercase' as any, lineHeight:1, marginBottom:'6px', fontFamily:pf }}>
                    {bizName?.split(' ')[0]||'Your'}<br /><span style={{ color:pp }}>{bizName?.split(' ').slice(1).join(' ')||'Business'}</span>
                  </div>
                  <div style={{ fontSize:'11px', color:'#666', marginBottom:'14px' }}>{form.tagline||'Your tagline here'}</div>
                  <div style={{ display:'inline-flex', padding:'8px 14px', background:pp, color:'#000', borderRadius:pr, fontSize:'11px', fontWeight:700, textTransform:'uppercase' as any, fontFamily:pf }}>⚡ Book a service</div>
                </div>
                <div style={{ padding:'12px', background:'#0a0a0a' }}>
                  <div style={{ border:'1px solid #222', borderRadius:pr, padding:'12px', background:'#111', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:pp }} />
                    <div style={{ fontSize:'12px', fontWeight:700, color:'#fff', textTransform:'uppercase' as any, marginBottom:'4px', fontFamily:pf }}>Panel Upgrade</div>
                    <div style={{ fontSize:'10px', color:'#666', marginBottom:'8px' }}>200A service, permitted and inspected.</div>
                    <div style={{ fontSize:'11px', color:pp, fontWeight:600 }}>$1,500 · Full day</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
