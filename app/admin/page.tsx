'use client'

// app/admin/page.tsx
// Internal admin portal — lists all tenants with status and quick actions.

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

export default function AdminPage() {
  const [tenants, setTenants]   = useState<Tenant[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase
      .from('tenants')
      .select('id, slug, name, plan, is_active, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTenants(data ?? [])
        setLoading(false)
      })
  }, [])

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
