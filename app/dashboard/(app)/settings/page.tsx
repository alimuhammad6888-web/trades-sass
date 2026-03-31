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
    primary_color: '#F4C300', accent_color: '#1a1a1a', tagline: '',
    phone: '', email: '', address_line1: '', city: '', state: '',
    border_radius: 'soft', font_style: 'sans', chatbot_greeting: '',
    booking_lead_time_hours: 2, booking_window_days: 60,
    auto_confirm_bookings: false,
    notification_email: '', notification_phone: '',
  })

  const [site, setSite] = useState({
    hero_headline: 'Your trusted local experts',
    hero_subheadline: 'Licensed, insured, and ready to help.',
    hero_badge: 'Now accepting online bookings',
    stats_json: [
      { value: '500+', label: 'Jobs completed' },
      { value: '4.9★', label: 'Google rating' },
      { value: '24hr', label: 'Response time' },
    ] as { value: string; label: string }[],
    why_us_json: [
      { icon: '🛡️', title: 'Licensed & insured', desc: 'Full coverage on every job' },
      { icon: '⚡', title: 'Same-day availability', desc: 'We work around your schedule' },
      { icon: '💬', title: 'Upfront pricing', desc: 'No surprises, no hidden fees' },
    ] as { icon: string; title: string; desc: string }[],
    cta_primary_text: 'Book a service',
    cta_secondary_text: 'Ready to get started?',
    cta_description: '',
    footer_tagline: 'Proudly serving our local community.',
    is_published: false,
  })
  const [siteExists, setSiteExists] = useState(false)

  function updateSite(key: string, value: any) {
    setSite(s => ({ ...s, [key]: value }))
  }

  function updateStat(idx: number, field: 'value' | 'label', val: string) {
    setSite(s => {
      const next = [...s.stats_json]
      next[idx] = { ...next[idx], [field]: val }
      return { ...s, stats_json: next }
    })
  }

  function updateWhyUs(idx: number, field: 'icon' | 'title' | 'desc', val: string) {
    setSite(s => {
      const next = [...s.why_us_json]
      next[idx] = { ...next[idx], [field]: val }
      return { ...s, why_us_json: next }
    })
  }

  useEffect(() => {
    if (!tenant?.id) return
    Promise.all([
      supabase.from('tenants').select('name').eq('id', tenant.id).single(),
      supabase.from('business_settings').select('*').eq('tenant_id', tenant.id).single(),
      supabase.from('tenant_site_content').select('*').eq('tenant_id', tenant.id).single(),
    ]).then(([tr, sr, siteR]) => {
      if (tr.data) setBizName(tr.data.name)
      if (sr.data) {
        const s = sr.data
        setForm(f => ({
          ...f,
          primary_color:            s.primary_color            ?? f.primary_color,
          accent_color:             s.accent_color             ?? f.accent_color,
          tagline:                  s.tagline                  ?? '',
          phone:                    s.phone                    ?? '',
          email:                    s.email                    ?? '',
          address_line1:            s.address_line1            ?? '',
          city:                     s.city                     ?? '',
          state:                    s.state                    ?? '',
          border_radius:            s.border_radius            ?? 'soft',
          font_style:               s.font_style               ?? 'sans',
          chatbot_greeting:         s.chatbot_greeting         ?? '',
          booking_lead_time_hours:  s.booking_lead_time_hours  ?? 2,
          booking_window_days:      s.booking_window_days      ?? 60,
          auto_confirm_bookings:    s.auto_confirm_bookings    ?? false,
          notification_email:       s.notification_email       ?? '',
          notification_phone:       s.notification_phone       ?? '',
        }))
      }
      if (siteR.data) {
        setSiteExists(true)
        const sc = siteR.data
        setSite(s => ({
          ...s,
          hero_headline:      sc.hero_headline      ?? s.hero_headline,
          hero_subheadline:   sc.hero_subheadline   ?? s.hero_subheadline,
          hero_badge:         sc.hero_badge         ?? s.hero_badge,
          stats_json:         sc.stats_json         ?? s.stats_json,
          why_us_json:        sc.why_us_json        ?? s.why_us_json,
          cta_primary_text:   sc.cta_primary_text   ?? s.cta_primary_text,
          cta_secondary_text: sc.cta_secondary_text ?? s.cta_secondary_text,
          cta_description:    sc.cta_description    ?? s.cta_description,
          footer_tagline:     sc.footer_tagline     ?? s.footer_tagline,
          is_published:       sc.is_published       ?? false,
        }))
      }
      setFetched(true)
    })
  }, [tenant?.id])

  function update(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function save() {
    setSaving(true)
    const sitePayload = {
      tenant_id: tenant!.id,
      hero_headline: site.hero_headline,
      hero_subheadline: site.hero_subheadline,
      hero_badge: site.hero_badge,
      stats_json: site.stats_json,
      why_us_json: site.why_us_json,
      cta_primary_text: site.cta_primary_text,
      cta_secondary_text: site.cta_secondary_text,
      cta_description: site.cta_description,
      footer_tagline: site.footer_tagline,
      is_published: site.is_published,
    }

    await Promise.all([
      supabase.from('tenants').update({ name: bizName }).eq('id', tenant!.id),
      supabase.from('business_settings').update(form).eq('tenant_id', tenant!.id),
      siteExists
        ? supabase.from('tenant_site_content').update(sitePayload).eq('tenant_id', tenant!.id)
        : supabase.from('tenant_site_content').insert(sitePayload),
    ])

    setSiteExists(true)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const inp: any = { width:'100%', padding:'9px 11px', border:`1px solid ${T.inputBorder}`, borderRadius:'6px', fontSize:'13px', fontFamily:'sans-serif', color:T.t1, background:T.input, outline:'none', boxSizing:'border-box', transition:'background 0.2s, color 0.2s' }
  const lbl: any = { fontSize:'11px', fontWeight:500, color:T.t3, textTransform:'uppercase' as any, letterSpacing:'0.06em', display:'block', marginBottom:'5px' }
  const card: any = { background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'20px', marginBottom:'16px', transition:'background 0.2s' }
  const cardTitle: any = { fontFamily:'Georgia,serif', fontSize:'14px', fontStyle:'italic', color:T.t1, marginBottom:'16px', paddingBottom:'10px', borderBottom:`1px solid ${T.divider}` }
  const hint: any = { fontSize:'11px', color:T.t3, marginTop:'5px', lineHeight:1.5 }

  const pp = form.primary_color
  const pr = ({ sharp:'0px', soft:'6px', round:'14px' } as any)[form.border_radius] ?? '6px'
  const pf = ({ sans:"'DM Sans',sans-serif", serif:'Georgia,serif', slab:'Rockwell,serif' } as any)[form.font_style] ?? 'sans-serif'

  const TABS = ['branding', 'contact', 'notifications', 'booking', 'website']

  return (
    <div style={{ minHeight:'100vh', background:T.bg, fontFamily:'sans-serif', transition:'background 0.2s' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.7}} .settings-grid{display:grid;grid-template-columns:1fr 300px;gap:20px;padding:20px;max-width:1000px;} @media(max-width:768px){.settings-grid{grid-template-columns:1fr!important;} .preview-panel{display:none!important;}}`}</style>

      {/* Header */}
      <div style={{ padding:'20px 20px 0', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontFamily:'Georgia,serif', fontSize:'22px', fontStyle:'italic', color:T.t1, marginBottom:'4px' }}>Settings</h1>
          <p style={{ fontSize:'13px', color:T.t3 }}>Branding, contact info, notifications, booking rules, and website content</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {saved && <span style={{ fontSize:'13px', color:'#1a6b4a' }}>✓ Saved</span>}
          <button onClick={save} disabled={saving || !fetched}
            style={{ padding:'8px 20px', background:T.isDark?'#F4C300':'#1a1917', color:T.isDark?'#000':'#fff', border:'none', borderRadius:'6px', fontSize:'13px', fontWeight:600, cursor:saving?'not-allowed':'pointer', opacity:saving||!fetched?0.5:1, fontFamily:'sans-serif' }}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background:T.card, borderBottom:`1px solid ${T.border}`, padding:'0 20px', display:'flex', marginTop:'16px', overflowX:'auto', transition:'background 0.2s' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'12px 16px', border:'none', borderBottom:`2px solid ${tab===t?T.t1:'transparent'}`, background:'transparent', fontSize:'13px', fontWeight:500, color:tab===t?T.t1:T.t3, cursor:'pointer', fontFamily:'sans-serif', textTransform:'capitalize', whiteSpace:'nowrap', transition:'color 0.2s' }}>
            {t === 'notifications' ? '🔔 Notifications' : t.charAt(0).toUpperCase()+t.slice(1)}
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

            {/* ── BRANDING ── */}
            {tab === 'branding' && (
              <>
                <div style={card}>
                  <div style={cardTitle}>Business identity</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                    <div>
                      <label style={lbl}>Business name</label>
                      <input style={inp} value={bizName} onChange={e => setBizName(e.target.value)} />
                    </div>
                    <div>
                      <label style={lbl}>Tagline</label>
                      <input style={inp} value={form.tagline} onChange={e => update('tagline', e.target.value)} placeholder="e.g. Everything is no problem." />
                    </div>
                  </div>
                </div>

                <div style={card}>
                  <div style={cardTitle}>Colors</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
                    {[{key:'primary_color',label:'Primary color'},{key:'accent_color',label:'Accent color'}].map(f => (
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

            {/* ── CONTACT ── */}
            {tab === 'contact' && (
              <div style={card}>
                <div style={cardTitle}>Contact information</div>
                <p style={{ fontSize:'13px', color:T.t3, marginBottom:'16px' }}>
                  Shown to customers on the booking page and confirmation emails.
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {[
                    {key:'phone',        label:'Business phone', ph:'(555) 000-0000',          hint:'Shown on the booking page'},
                    {key:'email',        label:'Business email', ph:'hello@yourbusiness.com',   hint:'Shown on the booking page and customer emails'},
                    {key:'address_line1',label:'Address',        ph:'123 Main St',              hint:''},
                    {key:'city',         label:'City',           ph:'Los Angeles',              hint:''},
                    {key:'state',        label:'State',          ph:'CA',                       hint:''},
                  ].map(field => (
                    <div key={field.key}>
                      <label style={lbl}>{field.label}</label>
                      <input style={inp} value={(form as any)[field.key]} onChange={e => update(field.key, e.target.value)} placeholder={field.ph} />
                      {field.hint && <div style={hint}>{field.hint}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {tab === 'notifications' && (
              <>
                <div style={{ ...card, border:`1px solid ${T.isDark?'#2a3a5a':'#d0e4f7'}`, background:T.isDark?'#0a1a2a':T.card }}>
                  <div style={cardTitle}>🔔 Owner notifications</div>
                  <p style={{ fontSize:'13px', color:T.t3, marginBottom:'20px', lineHeight:1.6 }}>
                    Where should we send booking alerts? These are private — not shown to customers. If left blank we'll use your business contact details above.
                  </p>

                  <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                    <div>
                      <label style={lbl}>Notification email</label>
                      <input style={inp} type="email" value={form.notification_email} onChange={e => update('notification_email', e.target.value)} placeholder="you@gmail.com" />
                      <div style={hint}>New booking requests and confirmation links are sent here. Use your personal email, not the business one.</div>
                    </div>

                    <div>
                      <label style={lbl}>Notification phone (SMS)</label>
                      <input style={inp} type="tel" value={form.notification_phone} onChange={e => update('notification_phone', e.target.value)} placeholder="(555) 000-0000" />
                      <div style={hint}>You'll get a text for every new booking. Reply YES to confirm it instantly.</div>
                    </div>
                  </div>
                </div>

                {/* Status preview */}
                <div style={{ ...card, background:T.isDark?'#111':'#f8f6f1' }}>
                  <div style={cardTitle}>Current notification routing</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {[
                      {
                        label: 'Email alerts going to',
                        value: form.notification_email || form.email || 'Not set',
                        ok:    !!(form.notification_email || form.email),
                        note:  form.notification_email ? 'notification email' : form.email ? 'business email (fallback)' : '',
                      },
                      {
                        label: 'SMS alerts going to',
                        value: form.notification_phone || form.phone || 'Not set',
                        ok:    !!(form.notification_phone || form.phone),
                        note:  form.notification_phone ? 'notification phone' : form.phone ? 'business phone (fallback)' : '',
                      },
                    ].map(row => (
                      <div key={row.label} style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', padding:'12px', background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px' }}>
                        <div>
                          <div style={{ fontSize:'11px', fontWeight:500, color:T.t3, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px' }}>{row.label}</div>
                          <div style={{ fontSize:'13px', fontWeight:600, color:T.t1 }}>{row.value}</div>
                          {row.note && <div style={{ fontSize:'11px', color:T.t3, marginTop:'2px' }}>via {row.note}</div>}
                        </div>
                        <div style={{ fontSize:'11px', fontWeight:600, padding:'3px 8px', borderRadius:'20px', background:row.ok?'#e8f5ee':'#fdf0ef', color:row.ok?'#1a6b4a':'#8c2820', flexShrink:0, whiteSpace:'nowrap' }}>
                          {row.ok ? '✓ Set' : '✗ Not set'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── BOOKING ── */}
            {tab === 'booking' && (
              <div style={card}>
                <div style={cardTitle}>Booking settings</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                  <div>
                    <label style={lbl}>Lead time (hours)</label>
                    <input style={inp} type="number" value={form.booking_lead_time_hours} onChange={e => update('booking_lead_time_hours', parseInt(e.target.value))} />
                    <div style={hint}>Minimum hours before a customer can book</div>
                  </div>
                  <div>
                    <label style={lbl}>Booking window (days)</label>
                    <input style={inp} type="number" value={form.booking_window_days} onChange={e => update('booking_window_days', parseInt(e.target.value))} />
                    <div style={hint}>How far ahead customers can book</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <input type="checkbox" id="autoconfirm" checked={form.auto_confirm_bookings} onChange={e => update('auto_confirm_bookings', e.target.checked)} style={{ width:'16px', height:'16px', accentColor:T.isDark?'#F4C300':'#1a1917' }} />
                    <label htmlFor="autoconfirm" style={{ fontSize:'13px', color:T.t1, cursor:'pointer' }}>Auto-confirm bookings</label>
                  </div>
                  {form.auto_confirm_bookings && (
                    <div style={{ background:T.isDark?'#0a1a2a':'#eef4fb', border:`1px solid ${T.isDark?'#1a3a5a':'#d0e4f7'}`, borderRadius:'6px', padding:'10px 14px', fontSize:'12px', color:T.isDark?'#5a9fd4':'#1e4d8c' }}>
                      Auto-confirm is on — bookings will be marked confirmed immediately without requiring your approval.
                    </div>
                  )}
                  <div>
                    <label style={lbl}>Chatbot greeting</label>
                    <input style={inp} value={form.chatbot_greeting} onChange={e => update('chatbot_greeting', e.target.value)} placeholder="Hi! How can I help you today?" />
                  </div>
                </div>
              </div>
            )}

            {/* ── WEBSITE ── */}
            {tab === 'website' && (
              <>
                {/* Publish toggle */}
                <div style={{ ...card, border:`1px solid ${site.is_published?(T.isDark?'#1a3a2a':'#c3e6cb'):T.border}`, background:site.is_published?(T.isDark?'#0a1a12':'#f0faf4'):T.card }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:600, color:T.t1 }}>
                        {site.is_published ? '🟢 Website is live' : '⚪ Website is unpublished'}
                      </div>
                      <div style={{ fontSize:'12px', color:T.t3, marginTop:'4px' }}>
                        {site.is_published ? 'Customers can see your site content' : 'Only the booking page is visible to customers'}
                      </div>
                    </div>
                    <button
                      onClick={() => updateSite('is_published', !site.is_published)}
                      style={{ padding:'6px 16px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:600, fontFamily:'sans-serif', background:site.is_published?'#1a6b4a':(T.isDark?'#333':'#ddd'), color:site.is_published?'#fff':T.t2 }}>
                      {site.is_published ? 'Published' : 'Publish'}
                    </button>
                  </div>
                </div>

                {/* Hero section */}
                <div style={card}>
                  <div style={cardTitle}>Hero section</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                    <div>
                      <label style={lbl}>Badge text</label>
                      <input style={inp} value={site.hero_badge} onChange={e => updateSite('hero_badge', e.target.value)} placeholder="Now accepting online bookings" />
                      <div style={hint}>Small pill shown above the headline</div>
                    </div>
                    <div>
                      <label style={lbl}>Headline</label>
                      <input style={inp} value={site.hero_headline} onChange={e => updateSite('hero_headline', e.target.value)} placeholder="Your trusted local experts" />
                    </div>
                    <div>
                      <label style={lbl}>Subheadline</label>
                      <input style={inp} value={site.hero_subheadline} onChange={e => updateSite('hero_subheadline', e.target.value)} placeholder="Licensed, insured, and ready to help." />
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div style={card}>
                  <div style={cardTitle}>Stats bar</div>
                  <p style={{ fontSize:'12px', color:T.t3, marginBottom:'14px' }}>Three key numbers shown below the hero.</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {site.stats_json.map((stat, i) => (
                      <div key={i} style={{ display:'grid', gridTemplateColumns:'100px 1fr', gap:'8px', alignItems:'center' }}>
                        <input style={{ ...inp, textAlign:'center' as any, fontWeight:700 }} value={stat.value} onChange={e => updateStat(i, 'value', e.target.value)} placeholder="500+" />
                        <input style={inp} value={stat.label} onChange={e => updateStat(i, 'label', e.target.value)} placeholder="Jobs completed" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Why us */}
                <div style={card}>
                  <div style={cardTitle}>Why choose us</div>
                  <p style={{ fontSize:'12px', color:T.t3, marginBottom:'14px' }}>Three selling points shown on the homepage.</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                    {site.why_us_json.map((item, i) => (
                      <div key={i} style={{ padding:'12px', border:`1px solid ${T.border}`, borderRadius:'6px', background:T.isDark?'#111':'#fafaf9' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'50px 1fr', gap:'8px', marginBottom:'8px' }}>
                          <div>
                            <label style={lbl}>Icon</label>
                            <input style={{ ...inp, textAlign:'center' as any, fontSize:'18px', padding:'6px' }} value={item.icon} onChange={e => updateWhyUs(i, 'icon', e.target.value)} />
                          </div>
                          <div>
                            <label style={lbl}>Title</label>
                            <input style={inp} value={item.title} onChange={e => updateWhyUs(i, 'title', e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label style={lbl}>Description</label>
                          <input style={inp} value={item.desc} onChange={e => updateWhyUs(i, 'desc', e.target.value)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTAs & footer */}
                <div style={card}>
                  <div style={cardTitle}>Buttons & footer</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                      <div>
                        <label style={lbl}>Primary CTA text</label>
                        <input style={inp} value={site.cta_primary_text} onChange={e => updateSite('cta_primary_text', e.target.value)} placeholder="Book a service" />
                        <div style={hint}>Main button in hero and CTA banner</div>
                      </div>
                      <div>
                        <label style={lbl}>CTA banner headline</label>
                        <input style={inp} value={site.cta_secondary_text} onChange={e => updateSite('cta_secondary_text', e.target.value)} placeholder="Ready to get started?" />
                        <div style={hint}>Large text in the bottom CTA section</div>
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>CTA banner description</label>
                      <input style={inp} value={site.cta_description} onChange={e => updateSite('cta_description', e.target.value)} placeholder="Book online in 60 seconds or call us directly." />
                      <div style={hint}>Shown below the CTA headline</div>
                    </div>
                    <div>
                      <label style={lbl}>Footer tagline</label>
                      <input style={inp} value={site.footer_tagline} onChange={e => updateSite('footer_tagline', e.target.value)} placeholder="Proudly serving our local community." />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Live preview — branding tab only, hidden on mobile */}
          <div className="preview-panel">
            {tab === 'branding' && (
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
            )}
          </div>
        </div>
      )}
    </div>
  )
}
