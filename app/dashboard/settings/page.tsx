'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TENANT_ID = '11111111-1111-1111-1111-111111111111'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState('branding')
  const [bizName, setBizName] = useState('')
  const [form, setForm] = useState({
    primary_color: '#F4C300',
    accent_color:  '#1a1a1a',
    bg_color:      '#0d0d0d',
    tagline:       '',
    phone:         '',
    email:         '',
    address_line1: '',
    city:          '',
    state:         '',
    border_radius: 'soft',
    font_style:    'sans',
    chatbot_greeting: '',
    booking_lead_time_hours: 2,
    booking_window_days: 60,
    auto_confirm_bookings: false,
  })

  useEffect(() => {
    checkAuth()
    loadSettings()
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) router.push('/dashboard/login')
  }

  async function loadSettings() {
    const [tenantRes, settingsRes] = await Promise.all([
      supabase.from('tenants').select('name').eq('id', TENANT_ID).single(),
      supabase.from('business_settings').select('*').eq('tenant_id', TENANT_ID).single(),
    ])
    if (tenantRes.data) setBizName(tenantRes.data.name)
    if (settingsRes.data) {
      const s = settingsRes.data
      setForm(f => ({
        ...f,
        primary_color: s.primary_color ?? f.primary_color,
        accent_color:  s.accent_color  ?? f.accent_color,
        bg_color:      s.bg_color      ?? f.bg_color,
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
    setLoading(false)
  }

  function update(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }))
    if (key === 'primary_color') document.documentElement.style.setProperty('--brand-primary', value)
    if (key === 'accent_color')  document.documentElement.style.setProperty('--brand-accent',  value)
  }

  async function save() {
    setSaving(true)
    await Promise.all([
      supabase.from('tenants').update({ name: bizName }).eq('id', TENANT_ID),
      supabase.from('business_settings').update(form).eq('tenant_id', TENANT_ID),
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const PALETTES = [
    { label: 'Electric', p: '#F4C300', a: '#1a1a1a' },
    { label: 'Navy',     p: '#1C3D5A', a: '#3B82C4' },
    { label: 'Forest',   p: '#1D4E35', a: '#34A668' },
    { label: 'Slate',    p: '#334155', a: '#64748b' },
    { label: 'Ruby',     p: '#8B1A1A', a: '#DC2626' },
    { label: 'Midnight', p: '#1e1b4b', a: '#818cf8' },
  ]

  const inp: any  = { width: '100%', padding: '8px 11px', border: '1px solid #e8e4dc', borderRadius: '6px', fontSize: '13.5px', fontFamily: 'sans-serif', color: '#1a1917', background: '#fff', outline: 'none', boxSizing: 'border-box' }
  const lbl: any  = { fontSize: '11px', fontWeight: 500, color: '#9a9590', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }
  const card: any = { background: '#fff', border: '1px solid #e8e4dc', borderRadius: '8px', padding: '20px', marginBottom: '16px' }
  const cardTitle: any = { fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'italic', color: '#1a1917', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #f0ede6' }

  const pp = form.primary_color
  const rMap: any = { sharp: '0px', soft: '6px', round: '14px' }
  const pr = rMap[form.border_radius] ?? '6px'
  const fontMap: any = { sans: "'DM Sans', sans-serif", serif: 'Georgia, serif', slab: 'Rockwell, serif' }
  const pf = fontMap[form.font_style] ?? 'sans-serif'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f6f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#9a9590' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8f6f1', fontFamily: 'sans-serif' }}>

      <div style={{ background: '#1a1917', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <a href="/dashboard" style={{ color: '#888', fontSize: '13px', textDecoration: 'none' }}>← Overview</a>
        <span style={{ color: '#f0ede6', fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Settings</span>
      </div>

      <div style={{ background: '#fff', borderBottom: '1px solid #e8e4dc', padding: '0 24px', display: 'flex' }}>
        {['branding', 'contact', 'booking'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '12px 16px', border: 'none', borderBottom: `2px solid ${tab === t ? '#1a1917' : 'transparent'}`, background: 'transparent', fontSize: '13px', fontWeight: 500, color: tab === t ? '#1a1917' : '#9a9590', cursor: 'pointer', fontFamily: 'sans-serif', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>

        <div>
          {tab === 'branding' && (
            <>
              <div style={card}>
                <div style={cardTitle}>Business identity</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={lbl}>Primary color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #e8e4dc', borderRadius: '6px', padding: '8px 12px', background: '#fff' }}>
                      <input
                        type="color"
                        value={form.primary_color}
                        onChange={e => update('primary_color', e.target.value)}
                        style={{ width: '40px', height: '30px', border: '1px solid #e8e4dc', borderRadius: '4px', cursor: 'pointer', padding: '2px' }}
                      />
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#1a1917' }}>{form.primary_color}</span>
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Accent color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #e8e4dc', borderRadius: '6px', padding: '8px 12px', background: '#fff' }}>
                      <input
                        type="color"
                        value={form.accent_color}
                        onChange={e => update('accent_color', e.target.value)}
                        style={{ width: '40px', height: '30px', border: '1px solid #e8e4dc', borderRadius: '4px', cursor: 'pointer', padding: '2px' }}
                      />
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#1a1917' }}>{form.accent_color}</span>
                    </div>
                  </div>
                </div>

                <label style={lbl}>Quick palettes</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {PALETTES.map(pal => (
                    <button key={pal.label}
                      onClick={() => { update('primary_color', pal.p); update('accent_color', pal.a) }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', border: `1.5px solid ${form.primary_color === pal.p ? pal.p : '#e8e4dc'}`, borderRadius: '20px', background: form.primary_color === pal.p ? pal.p + '22' : 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: 500, fontFamily: 'sans-serif', color: '#1a1917' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: pal.p }} />
                      {pal.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={card}>
                <div style={cardTitle}>Style</div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={lbl}>Corner style</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['sharp', 'soft', 'round'].map(r => (
                      <button key={r} onClick={() => update('border_radius', r)}
                        style={{ padding: '6px 16px', border: `1.5px solid ${form.border_radius === r ? '#1a1917' : '#e8e4dc'}`, borderRadius: r === 'sharp' ? '2px' : r === 'soft' ? '6px' : '20px', background: form.border_radius === r ? '#1a1917' : 'transparent', color: form.border_radius === r ? '#fff' : '#4a4843', cursor: 'pointer', fontSize: '12px', fontWeight: 500, fontFamily: 'sans-serif' }}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Heading font</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { key: 'sans',  label: 'Sans',  fam: 'DM Sans, sans-serif' },
                      { key: 'serif', label: 'Serif', fam: 'Georgia, serif' },
                      { key: 'slab',  label: 'Slab',  fam: 'Rockwell, serif' },
                    ].map(f => (
                      <button key={f.key} onClick={() => update('font_style', f.key)}
                        style={{ padding: '6px 16px', border: `1.5px solid ${form.font_style === f.key ? '#1a1917' : '#e8e4dc'}`, borderRadius: '6px', background: form.font_style === f.key ? '#1a1917' : 'transparent', color: form.font_style === f.key ? '#fff' : '#4a4843', cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: f.fam }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'contact' && (
            <div style={card}>
              <div style={cardTitle}>Contact information</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { key: 'phone',         label: 'Phone',   placeholder: '(555) 000-0000' },
                  { key: 'email',         label: 'Email',   placeholder: 'hello@yourbusiness.com' },
                  { key: 'address_line1', label: 'Address', placeholder: '123 Main St' },
                  { key: 'city',          label: 'City',    placeholder: 'Los Angeles' },
                  { key: 'state',         label: 'State',   placeholder: 'CA' },
                ].map(field => (
                  <div key={field.key}>
                    <label style={lbl}>{field.label}</label>
                    <input style={inp} value={(form as any)[field.key]} onChange={e => update(field.key, e.target.value)} placeholder={field.placeholder} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'booking' && (
            <div style={card}>
              <div style={cardTitle}>Booking settings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={lbl}>Lead time (hours)</label>
                  <input style={inp} type="number" value={form.booking_lead_time_hours} onChange={e => update('booking_lead_time_hours', parseInt(e.target.value))} />
                  <div style={{ fontSize: '11px', color: '#9a9590', marginTop: '4px' }}>Minimum hours before a customer can book</div>
                </div>
                <div>
                  <label style={lbl}>Booking window (days)</label>
                  <input style={inp} type="number" value={form.booking_window_days} onChange={e => update('booking_window_days', parseInt(e.target.value))} />
                  <div style={{ fontSize: '11px', color: '#9a9590', marginTop: '4px' }}>How far ahead customers can book</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="checkbox" id="autoconfirm" checked={form.auto_confirm_bookings} onChange={e => update('auto_confirm_bookings', e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#1a1917' }} />
                  <label htmlFor="autoconfirm" style={{ fontSize: '13px', color: '#1a1917', cursor: 'pointer' }}>Auto-confirm bookings</label>
                </div>
                <div>
                  <label style={lbl}>Chatbot greeting</label>
                  <input style={inp} value={form.chatbot_greeting} onChange={e => update('chatbot_greeting', e.target.value)} placeholder="Hi! How can I help you today?" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live preview */}
        <div>
          <div style={{ position: 'sticky', top: '20px' }}>
            <div style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9a9590', marginBottom: '10px' }}>
              Live preview
            </div>
            <div style={{ border: '1px solid #e8e4dc', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#111', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: pp, fontWeight: 800, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: pf }}>
                  {bizName || 'Your Business'}
                </span>
                <span style={{ background: pp, color: '#000', padding: '4px 10px', borderRadius: pr, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                  Book now
                </span>
              </div>
              <div style={{ background: '#0d0d0d', padding: '20px 16px' }}>
                <div style={{ fontSize: '9px', color: pp, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  Licensed · Bonded · Insured
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#fff', textTransform: 'uppercase', lineHeight: 1, marginBottom: '6px', fontFamily: pf }}>
                  {bizName?.split(' ')[0] || 'Your'}<br />
                  <span style={{ color: pp }}>{bizName?.split(' ').slice(1).join(' ') || 'Business'}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '14px' }}>
                  {form.tagline || 'Your tagline here'}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: pp, color: '#000', borderRadius: pr, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', fontFamily: pf }}>
                  ⚡ Book a service
                </div>
              </div>
              <div style={{ padding: '12px', background: '#0a0a0a' }}>
                <div style={{ border: '1px solid #222', borderRadius: pr, padding: '12px', background: '#111', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: pp }} />
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', marginBottom: '4px', fontFamily: pf }}>Panel Upgrade</div>
                  <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>200A service upgrade, permitted and inspected.</div>
                  <div style={{ fontSize: '11px', color: pp, fontWeight: 600 }}>$1,500 · Full day</div>
                </div>
              </div>
            </div>

            <button onClick={save} disabled={saving}
              style={{ width: '100%', marginTop: '12px', padding: '11px', background: saved ? '#1a6b4a' : '#1a1917', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'sans-serif', opacity: saving ? 0.7 : 1, transition: 'background 0.2s' }}>
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save changes'}
            </button>
            <p style={{ fontSize: '11px', color: '#9a9590', textAlign: 'center', marginTop: '8px' }}>
              Changes apply to your booking page immediately
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
