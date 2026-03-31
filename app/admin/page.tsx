'use client'

// app/admin/page.tsx
// Internal admin portal — lists all tenants with status and quick actions.

import { useEffect, useState } from 'react'

type Tenant = {
  id: string
  slug: string
  name: string
  plan: string
  is_active: boolean
  created_at: string
}

const BG     = '#0f0f0f'
const CARD   = '#161616'
const BORDER = '#2e2e2e'
const Y      = '#F4C300'
const T1     = '#ffffff'
const T2     = '#a0a0a0'
const T3     = '#666666'

const planBadge: Record<string, { bg: string; color: string }> = {
  free:       { bg: '#1a2a1a', color: '#4ade80' },
  pro:        { bg: '#1a1a2e', color: '#818cf8' },
  enterprise: { bg: '#2e1a1a', color: '#f59e0b' },
}

function getAdminKey(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('admin_key')
}

function setAdminKey(key: string) {
  sessionStorage.setItem('admin_key', key)
}

export default function AdminPage() {
  const [tenants, setTenants]   = useState<Tenant[]>([])
  const [loading, setLoading]   = useState(true)
  const [authError, setAuthError] = useState(false)
  const [keyInput, setKeyInput] = useState('')

  function loadTenants(key: string) {
    setLoading(true)
    setAuthError(false)
    fetch('/api/admin/tenants/list', {
      headers: { 'x-admin-key': key }
    })
      .then(r => {
        if (r.status === 401) { setAuthError(true); setLoading(false); sessionStorage.removeItem('admin_key'); return null }
        return r.json()
      })
      .then(data => {
        if (!data) return
        setTenants(data.tenants ?? [])
        setAdminKey(key)
        setLoading(false)
      })
      .catch(() => { setAuthError(true); setLoading(false) })
  }

  useEffect(() => {
    const saved = getAdminKey()
    if (saved) { loadTenants(saved) } else { setAuthError(true); setLoading(false) }
  }, [])

  // ── Auth gate ────────────────────────────────────────────────
  if (authError && !loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: T1, fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '360px', padding: '40px 20px' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontFamily: 'Georgia,serif', fontSize: '20px', fontStyle: 'italic', marginBottom: '8px' }}>Admin Portal</h2>
          <p style={{ fontSize: '13px', color: T3, marginBottom: '20px' }}>Enter admin key to continue</p>
          <input
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && keyInput.trim()) loadTenants(keyInput.trim()) }}
            placeholder="Admin key"
            style={{ width: '100%', padding: '10px 14px', background: '#111', border: `1px solid ${BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '14px', fontFamily: 'sans-serif', boxSizing: 'border-box', outline: 'none', marginBottom: '12px' }}
          />
          <button
            onClick={() => { if (keyInput.trim()) loadTenants(keyInput.trim()) }}
            style={{ width: '100%', padding: '12px', background: Y, color: '#000', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'sans-serif' }}>
            Unlock
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: T1, fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#111', borderBottom: `3px solid ${Y}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Georgia,serif', fontSize: '20px', color: Y, fontStyle: 'italic' }}>Admin Portal</span>
        <span style={{ fontSize: '12px', color: T3 }}>Internal use only</span>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '28px 20px' }}>
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '22px', margin: 0, fontStyle: 'italic' }}>Tenants</h1>
            <p style={{ fontSize: '13px', color: T3, margin: '4px 0 0' }}>{tenants.length} total</p>
          </div>
          <a href="/admin/tenants/new" style={{
            padding: '10px 20px', background: Y, color: '#000', border: 'none', borderRadius: '6px',
            fontSize: '13px', fontWeight: 700, textDecoration: 'none', fontFamily: 'sans-serif',
          }}>
            + New tenant
          </a>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: T3, fontSize: '14px' }}>Loading tenants...</div>
        )}

        {/* Tenant table */}
        {!loading && tenants.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: T3, fontSize: '14px' }}>
            No tenants yet. Create your first one.
          </div>
        )}

        {!loading && tenants.length > 0 && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '10px 20px',
              borderBottom: `1px solid ${BORDER}`, fontSize: '11px', color: T3,
              textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
            }}>
              <span>Business</span>
              <span>Slug</span>
              <span>Plan</span>
              <span>Status</span>
              <span>Created</span>
            </div>

            {/* Rows */}
            {tenants.map(t => {
              const badge = planBadge[t.plan] ?? planBadge.free
              return (
                <div key={t.id} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '14px 20px',
                  borderBottom: `1px solid ${BORDER}`, fontSize: '13px', alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 600 }}>{t.name}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: T2 }}>{t.slug}</span>
                  <span>
                    <span style={{
                      background: badge.bg, color: badge.color, padding: '3px 10px',
                      borderRadius: '4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                    }}>
                      {t.plan}
                    </span>
                  </span>
                  <span style={{ color: t.is_active ? '#4ade80' : '#f87171', fontSize: '12px', fontWeight: 600 }}>
                    {t.is_active ? '● Active' : '● Inactive'}
                  </span>
                  <span style={{ color: T3, fontSize: '12px' }}>
                    {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
