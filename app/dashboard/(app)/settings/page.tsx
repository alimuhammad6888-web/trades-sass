'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useTenant } from '@/lib/tenant-context'

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

  const inp: any  = { width:'100%', padding:'8px 11px', border:'1px solid #e8e4dc', borderRadius:'6px', fontSize:'13px', fontFamily:'sans-serif', color:'#1a1917', background:'#fff', outline:'none', boxSizing:'border-box' }
  const lbl: any  = { fontSize:'11px', fontWeight:500, color:'#9a9590', textTransform:'uppercase' as any, letterSpacing:'0.06em', display:'block', marginBottom:'5px' }
  const card: any = { background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', padding:'20px', marginBottom:'16px' }
  const cardTitle: any = { fontFamily:'Georgia, serif', fontSize:'14px', fontStyle:'italic', color:'#1a1917', marginBottom:'16px', paddingBottom:'10px', borderBottom:'1px solid #f0ede6' }

  const pp = form.primary_color
  const pr = ({ sharp:'0px', soft:'6px', round:'14px' } as any)[form.border_radius] ?? '6px'
  const pf = ({ sans:"'DM Sans',sans-serif", serif:'Georgia,serif', slab:'Rockwell,serif' } as any)[form.font_style] ?? 'sans-serif'

  return (
    <div style={{ minHeight:'100vh', background:'#f8f6f1', fontFamily:'sans-serif' }}>
      <div style={{ padding:'24px 28px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'Georgia, serif', fontSize:'22px', fontStyle:'italic', color:'#1a1917', marginBottom:'4px' }}>Settings</h1>
          <p style={{ fontSize:'13px', color:'#9a9590' }}>Branding, contact info, and booking rules</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {saved && <span style={{ fontSize:'13px', color:'#1a6b4a' }}>✓ Saved</span>}
          <button onClick={save} disabled={saving || !fetched}
            style={{ padding:'8px 20px', background:'#1a1917', color:'#fff', border:'none', borderRadius:'6px', fontSize:'13px', fontWeight:500, cursor:saving?'not-allowed':'pointer', opacity:saving||!fetched?0.5:1, fontFamily:'sans-serif' }}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      <div style={{ background:'#fff', borderBottom:'1px solid #e8e4dc', padding:'0 28px', display:'flex', marginTop:'16px' }}>
        {['branding','contact','booking'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'12px 16px', border:'none', borderBottom:`2px solid ${tab===t?'#1a1917':'transparent'}`, background:'transparent', fontSize:'13px', fontWeight:500, color:tab===t?'#1a1917':'#9a9590', cursor:'pointer', fontFamily:'sans-serif', textTransform:'capitalize' as any }}>
            {t}
          </button>
        ))}
      </div>

      {!fetched ? (
        <div style={{ padding:'28px' }}>
          {[1,2,3].map(i => <div key={i} style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', height:'120px', marginBottom:'16px', animation:'pulse 1.5s ease infinite' }} />)}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:'20px', padding:'24px 28px', maxWidth:'1000px' }}>
          <div>
            {tab === 'branding' && (
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
                    <div>
                      <label style={lbl}>Primary color</label>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', border:'1px solid #e8e4dc', borderRadius:'6px', padding:'8px 12px' }}>
                        <input type="color" value={form.primary_color} onChange={e => update('primary_color', e.target.value)} style={{ width:'40px', height:'30px', border:'1px solid #e8e4dc', borderRadius:'4px', cursor:'pointer', padding:'2px' }} />
                        <span style={{ fontFamily:'monospace', fontSize:'12px', color:'#1a1917' }}>{form.primary_color}</span>
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Accent color</label>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', border:'1px solid #e8e4dc', borderRadius:'6px', padding:'8px 12px' }}>
                        <input type="color" value={form.accent_color} onChange={e => update('accent_color', e.target.value)} style={{ width:'40px', height:'30px', border:'1px solid #e8e4dc', borderRadius:'4px', cursor:'pointer', padding:'2px' }} />
                        <span style={{ fontFamily:'monospace', fontSize:'12px', color:'#1a1917' }}>{form.accent_color}</span>
                      </div>
                    </div>
                  </div>
                  <label style={lbl}>Quick palettes</label>
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' as any }}>
                    {PALETTES.map(pal => (
                      <button key={pal.label} onClick={() => { update('primary_color', pal.p); update('accent_color', pal.a) }}
                        style={{ display:'flex', alignItems:'center', gap:'6px', padding:'5px 12px', border:`1.5px solid ${form.primary_color===pal.p?pal.p:'#e8e4dc'}`, borderRadius:'20px', background:form.primary_color===pal.p?pal.p+'22':'transparent', cursor:'pointer', fontSize:'12px', fontWeight:500, fontFamily:'sans-serif', color:'#1a1917' }}>
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
                          style={{ padding:'6px 16px', border:`1.5px solid ${form.border_radius===r?'#1a1917':'#e8e4dc'}`, borderRadius:r==='sharp'?'2px':r==='soft'?'6px':'20px', background:form.border_radius===r?'#1a1917':'transparent', color:form.border_radius===r?'#fff':'#4a4843', cursor:'pointer', fontSize:'12px', fontWeight:500, fontFamily:'sans-serif' }}>{r}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Heading font</label>
                    <div style={{ display:'flex', gap:'8px' }}>
                      {[{key:'sans',label:'Sans',fam:'DM Sans,sans-serif'},{key:'serif',label:'Serif',fam:'Georgia,serif'},{key:'slab',label:'Slab',fam:'Rockwell,serif'}].map(f => (
                        <button key={f.key} onClick={() => update('font_style', f.key)}
                          style={{ padding:'6px 16px', border:`1.5px solid ${form.font_style===f.key?'#1a1917':'#e8e4dc'}`, borderRadius:'6px', background:form.font_style===f.key?'#1a1917':'transparent', color:form.font_style===f.key?'#fff':'#4a4843', cursor:'pointer', fontSize:'13px', fontWeight:500, fontFamily:f.fam }}>{f.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            {tab === 'contact' && (
              <div style={card}>
                <div style={cardTitle}>Contact information</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {[{key:'phone',label:'Phone',ph:'(555) 000-0000'},{key:'email',label:'Email',ph:'hello@yourbusiness.com'},{key:'address_line1',label:'Address',ph:'123 Main St'},{key:'city',label:'City',ph:'Los Angeles'},{key:'state',label:'State',ph:'CA'}].map(field => (
                    <div key={field.key}><label style={lbl}>{field.label}</label><input style={inp} value={(form as any)[field.key]} onChange={e => update(field.key, e.target.value)} placeholder={field.ph} /></div>
                  ))}
                </div>
              </div>
            )}
            {tab === 'booking' && (
              <div style={card}>
                <div style={cardTitle}>Booking settings</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                  <div><label style={lbl}>Lead time (hours)</label><input style={inp} type="number" value={form.booking_lead_time_hours} onChange={e => update('booking_lead_time_hours', parseInt(e.target.value))} /><div style={{ fontSize:'11px', color:'#9a9590', marginTop:'4px' }}>Minimum hours before a customer can book</div></div>
                  <div><label style={lbl}>Booking window (days)</label><input style={inp} type="number" value={form.booking_window_days} onChange={e => update('booking_window_days', parseInt(e.target.value))} /><div style={{ fontSize:'11px', color:'#9a9590', marginTop:'4px' }}>How far ahead customers can book</div></div>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}><input type="checkbox" id="autoconfirm" checked={form.auto_confirm_bookings} onChange={e => update('auto_confirm_bookings', e.target.checked)} style={{ width:'16px', height:'16px', accentColor:'#1a1917' }} /><label htmlFor="autoconfirm" style={{ fontSize:'13px', color:'#1a1917', cursor:'pointer' }}>Auto-confirm bookings</label></div>
                  <div><label style={lbl}>Chatbot greeting</label><input style={inp} value={form.chatbot_greeting} onChange={e => update('chatbot_greeting', e.target.value)} placeholder="Hi! How can I help you today?" /></div>
                </div>
              </div>
            )}
          </div>

          {/* Live preview */}
          <div>
            <div style={{ position:'sticky', top:'20px' }}>
              <div style={{ fontSize:'10px', fontWeight:500, textTransform:'uppercase' as any, letterSpacing:'0.07em', color:'#9a9590', marginBottom:'10px' }}>Live preview</div>
              <div style={{ border:'1px solid #e8e4dc', borderRadius:'8px', overflow:'hidden' }}>
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
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }`}</style>
    </div>
  )
}
