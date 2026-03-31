'use client'

// app/admin/tenants/new/page.tsx
// Onboarding form — creates tenant, business settings, hours, and owner auth user.

import { useState } from 'react'

const BG     = '#0f0f0f'
const CARD   = '#161616'
const BORDER = '#2e2e2e'
const Y      = '#F4C300'
const T1     = '#ffffff'
const T3     = '#666666'

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: '#111', border: `1px solid ${BORDER}`,
  borderRadius: '6px', color: '#fff', fontSize: '14px', fontFamily: 'sans-serif',
  boxSizing: 'border-box', outline: 'none',
}
const lbl: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase',
  letterSpacing: '0.06em', display: 'block', marginBottom: '5px',
}
const errS: React.CSSProperties = { fontSize: '11px', color: '#f87171', marginTop: '3px' }

type FormState = {
  name: string
  slug: string
  plan: string
  tagline: string
  phone: string
  email: string
  primary_color: string
  timezone: string
  owner_first_name: string
  owner_last_name: string
  owner_email: string
  owner_password: string
}

const INITIAL: FormState = {
  name: '', slug: '', plan: 'free', tagline: '', phone: '', email: '',
  primary_color: '#F4C300', timezone: 'America/Los_Angeles',
  owner_first_name: '', owner_last_name: '', owner_email: '', owner_password: '',
}

export default function NewTenantPage() {
  const [form, setForm]             = useState<FormState>(INITIAL)
  const [errors, setErrors]         = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]         = useState<{ success?: boolean; tenantId?: string; error?: string } | null>(null)

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  // Auto-generate slug from name
  function onNameChange(val: string) {
    set('name', val)
    if (!form.slug || form.slug === slugify(form.name)) {
      set('slug', slugify(val))
    }
  }

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.name.trim())             e.name = 'Required'
    if (!form.slug.match(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/) && form.slug.length > 1) e.slug = 'Lowercase letters, numbers, hyphens only'
    if (!form.slug.trim())             e.slug = 'Required'
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Valid email required'
    if (!form.owner_first_name.trim()) e.owner_first_name = 'Required'
    if (!form.owner_last_name.trim())  e.owner_last_name = 'Required'
    if (!form.owner_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.owner_email = 'Valid email required'
    if (form.owner_password.length < 8) e.owner_password = 'Min 8 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    setResult(null)

    try {
      const adminKey = typeof window !== 'undefined' ? sessionStorage.getItem('admin_key') : null
      if (!adminKey) {
        setResult({ error: 'Admin session expired. Go back to /admin and re-authenticate.' })
        setSubmitting(false)
        return
      }
      const res = await fetch('/api/admin/tenants/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setResult({ error: data.error || 'Something went wrong' })
      } else {
        setResult({ success: true, tenantId: data.tenantId })
      }
    } catch {
      setResult({ error: 'Network error. Please try again.' })
    }

    setSubmitting(false)
  }

  // ── Success screen ──────────────────────────────────────────
  if (result?.success) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: T1, fontFamily: 'sans-serif' }}>
        <div style={{ background: '#111', borderBottom: `3px solid ${Y}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Georgia,serif', fontSize: '20px', color: Y, fontStyle: 'italic' }}>Admin Portal</span>
        </div>
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', background: '#1a6b4a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{ fontFamily: 'Georgia,serif', fontSize: '22px', fontStyle: 'italic', marginBottom: '10px' }}>Tenant created!</h2>
          <p style={{ color: T3, fontSize: '14px', lineHeight: 1.7, marginBottom: '8px' }}>
            <strong style={{ color: T1 }}>{form.name}</strong> is live at{' '}
            <code style={{ background: '#111', padding: '2px 8px', borderRadius: '4px', fontSize: '13px', color: Y }}>/book/{form.slug}</code>
          </p>
          <p style={{ color: T3, fontSize: '13px', marginBottom: '24px' }}>
            Owner login: <strong style={{ color: T1 }}>{form.owner_email}</strong>
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <a href="/admin" style={{
              padding: '10px 20px', border: `1px solid ${BORDER}`, borderRadius: '6px',
              color: T1, textDecoration: 'none', fontSize: '13px', fontWeight: 600,
            }}>
              ← All tenants
            </a>
            <a href="/admin/tenants/new" onClick={() => { setForm(INITIAL); setResult(null) }} style={{
              padding: '10px 20px', background: Y, color: '#000', borderRadius: '6px',
              textDecoration: 'none', fontSize: '13px', fontWeight: 700,
            }}>
              + Create another
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG, color: T1, fontFamily: 'sans-serif' }}>
      <div style={{ background: '#111', borderBottom: `3px solid ${Y}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Georgia,serif', fontSize: '20px', color: Y, fontStyle: 'italic' }}>Admin Portal</span>
        <span style={{ fontSize: '12px', color: T3 }}>New tenant</span>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '28px 20px' }}>
        <a href="/admin" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>← Back to tenants</a>

        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '22px', fontStyle: 'italic', margin: '16px 0 24px' }}>
          Onboard new tenant
        </h1>

        {/* ── Business info ────────────────────────────────────── */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: Y, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Business info
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Business name *</label>
                <input style={inp} value={form.name} onChange={e => onNameChange(e.target.value)} placeholder="Acme Plumbing" />
                {errors.name && <div style={errS}>{errors.name}</div>}
              </div>
              <div>
                <label style={lbl}>Slug *</label>
                <input style={inp} value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="acme-plumbing" />
                {errors.slug && <div style={errS}>{errors.slug}</div>}
                <div style={{ fontSize: '11px', color: T3, marginTop: '3px' }}>/book/{form.slug || '...'}</div>
              </div>
            </div>

            <div>
              <label style={lbl}>Tagline</label>
              <input style={inp} value={form.tagline} onChange={e => set('tagline', e.target.value)} placeholder="Licensed & trusted since 2005" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Business email *</label>
                <input style={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="hello@acmeplumbing.com" />
                {errors.email && <div style={errS}>{errors.email}</div>}
              </div>
              <div>
                <label style={lbl}>Business phone</label>
                <input style={inp} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 000-0000" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Plan</label>
                <select style={{ ...inp, appearance: 'auto' }} value={form.plan} onChange={e => set('plan', e.target.value)}>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Brand color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="color" value={form.primary_color} onChange={e => set('primary_color', e.target.value)} style={{ width: '36px', height: '36px', border: 'none', background: 'none', cursor: 'pointer' }} />
                  <input style={{ ...inp, fontFamily: 'monospace', fontSize: '12px' }} value={form.primary_color} onChange={e => set('primary_color', e.target.value)} />
                </div>
              </div>
              <div>
                <label style={lbl}>Timezone</label>
                <select style={{ ...inp, appearance: 'auto' }} value={form.timezone} onChange={e => set('timezone', e.target.value)}>
                  <option value="America/New_York">Eastern</option>
                  <option value="America/Chicago">Central</option>
                  <option value="America/Denver">Mountain</option>
                  <option value="America/Los_Angeles">Pacific</option>
                  <option value="Pacific/Honolulu">Hawaii</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Owner account ────────────────────────────────────── */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: Y, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Owner account
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>First name *</label>
                <input style={inp} value={form.owner_first_name} onChange={e => set('owner_first_name', e.target.value)} />
                {errors.owner_first_name && <div style={errS}>{errors.owner_first_name}</div>}
              </div>
              <div>
                <label style={lbl}>Last name *</label>
                <input style={inp} value={form.owner_last_name} onChange={e => set('owner_last_name', e.target.value)} />
                {errors.owner_last_name && <div style={errS}>{errors.owner_last_name}</div>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Owner email *</label>
                <input style={inp} type="email" value={form.owner_email} onChange={e => set('owner_email', e.target.value)} placeholder="owner@acmeplumbing.com" />
                {errors.owner_email && <div style={errS}>{errors.owner_email}</div>}
              </div>
              <div>
                <label style={lbl}>Password *</label>
                <input style={inp} type="password" value={form.owner_password} onChange={e => set('owner_password', e.target.value)} placeholder="Min 8 characters" />
                {errors.owner_password && <div style={errS}>{errors.owner_password}</div>}
              </div>
            </div>

            <div style={{ background: '#111', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '10px 14px', fontSize: '12px', color: T3, lineHeight: 1.5 }}>
              The <code style={{ color: Y }}>handle_new_user()</code> trigger will auto-create the <code style={{ color: Y }}>users</code> row when the auth user is created.
            </div>
          </div>
        </div>

        {/* ── Error / submit ───────────────────────────────────── */}
        {result?.error && (
          <div style={{ background: '#2a1010', border: '1px solid #5a2020', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', color: '#ff6b6b', marginBottom: '16px' }}>
            {result.error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: '14px 24px', background: Y, color: '#000', border: 'none', borderRadius: '6px',
            fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%', fontFamily: 'sans-serif',
            opacity: submitting ? 0.6 : 1,
          }}>
          {submitting ? 'Creating tenant...' : 'Create tenant'}
        </button>
      </div>
    </div>
  )
}
