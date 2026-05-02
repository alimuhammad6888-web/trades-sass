'use client'

import { useEffect, useMemo, useState } from 'react'

type OnboardingRequest = {
  id: string
  status: 'new' | 'reviewing' | 'approved' | 'rejected' | string
  business_name: string
  owner_name: string | null
  owner_email: string
  owner_phone: string | null
  business_phone: string | null
  business_email: string | null
  service_area: string | null
  business_address: string | null
  desired_slug: string | null
  plan_interest: string | null
  brand_color: string | null
  google_review_url: string | null
  yelp_review_url: string | null
  services_text: string | null
  business_hours_text: string | null
  notes: string | null
  tenant_id: string | null
  invite_status: string
  auto_create_error: string | null
  created_at: string
}

const BG = '#0f0f0f'
const CARD = '#161616'
const BORDER = '#2e2e2e'
const Y = '#F4C300'
const T1 = '#ffffff'
const T2 = '#a0a0a0'
const T3 = '#666666'

const STATUS_OPTIONS = ['new', 'reviewing', 'approved', 'rejected'] as const

const statusBadge: Record<string, { bg: string; color: string }> = {
  new: { bg: '#2a2a1a', color: '#facc15' },
  reviewing: { bg: '#1a1a2e', color: '#93c5fd' },
  approved: { bg: '#1a2a1a', color: '#4ade80' },
  rejected: { bg: '#2e1a1a', color: '#f87171' },
}

function getAdminKey(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('admin_key')
}

function setAdminKey(key: string) {
  sessionStorage.setItem('admin_key', key)
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function DetailRow({ label, value, multiline = false }: { label: string; value: string | null | undefined; multiline?: boolean }) {
  if (!value) return null

  return (
    <div style={{ padding: '12px 0', borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: '10px', color: T3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '5px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', color: T1, lineHeight: 1.6, whiteSpace: multiline ? 'pre-wrap' : 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  )
}

export default function AdminOnboardingPage() {
  const [requests, setRequests] = useState<OnboardingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusSaving, setStatusSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  function loadRequests(key: string) {
    setLoading(true)
    setAuthError(false)
    setError('')

    fetch('/api/admin/onboarding/list', {
      headers: { 'x-admin-key': key },
    })
      .then(async r => {
        if (r.status === 401) {
          setAuthError(true)
          setLoading(false)
          sessionStorage.removeItem('admin_key')
          return null
        }
        const data = await r.json()
        if (!r.ok) {
          setError(data.error || 'Failed to load onboarding requests.')
          setLoading(false)
          return null
        }
        return data
      })
      .then(data => {
        if (!data) return
        const nextRequests = data.requests ?? []
        setRequests(nextRequests)
        setSelectedId(current => current ?? nextRequests[0]?.id ?? null)
        setAdminKey(key)
        setLoading(false)
      })
      .catch(() => {
        setAuthError(true)
        setLoading(false)
      })
  }

  useEffect(() => {
    const saved = getAdminKey()
    if (saved) {
      loadRequests(saved)
    } else {
      setAuthError(true)
      setLoading(false)
    }
  }, [])

  const selected = useMemo(
    () => requests.find(request => request.id === selectedId) ?? null,
    [requests, selectedId]
  )

  async function updateStatus(nextStatus: string) {
    if (!selected) return
    const adminKey = getAdminKey()
    if (!adminKey) {
      setAuthError(true)
      return
    }

    setStatusSaving(selected.id)
    setError('')

    try {
      const res = await fetch('/api/admin/onboarding/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({
          id: selected.id,
          status: nextStatus,
        }),
      })

      const data = await res.json().catch(() => null)

      if (res.status === 401) {
        setAuthError(true)
        sessionStorage.removeItem('admin_key')
        setStatusSaving(null)
        return
      }

      if (!res.ok) {
        setError(data?.error ?? 'Failed to update onboarding status.')
        setStatusSaving(null)
        return
      }

      setRequests(current =>
        current.map(request =>
          request.id === selected.id ? { ...request, status: nextStatus } : request
        )
      )
    } catch {
      setError('Network error. Please try again.')
    }

    setStatusSaving(null)
  }

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
            onKeyDown={e => { if (e.key === 'Enter' && keyInput.trim()) loadRequests(keyInput.trim()) }}
            placeholder="Admin key"
            style={{ width: '100%', padding: '10px 14px', background: '#111', border: `1px solid ${BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '14px', fontFamily: 'sans-serif', boxSizing: 'border-box', outline: 'none', marginBottom: '12px' }}
          />
          <button
            onClick={() => { if (keyInput.trim()) loadRequests(keyInput.trim()) }}
            style={{ width: '100%', padding: '12px', background: Y, color: '#000', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'sans-serif' }}
          >
            Unlock
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: T1, fontFamily: 'sans-serif' }}>
      <style>{`
        @media (max-width: 980px) {
          .admin-onboarding-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .admin-onboarding-detail-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>

      <div style={{ background: '#111', borderBottom: `3px solid ${Y}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Georgia,serif', fontSize: '20px', color: Y, fontStyle: 'italic' }}>Admin Portal</span>
        <span style={{ fontSize: '12px', color: T3 }}>Onboarding review</span>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div>
            <a href="/admin" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>← Back to admin</a>
            <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '22px', margin: '12px 0 0', fontStyle: 'italic' }}>Onboarding requests</h1>
            <p style={{ fontSize: '13px', color: T3, margin: '4px 0 0' }}>{requests.length} total</p>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: '16px', background: '#2e1a1a', border: `1px solid ${BORDER}`, color: '#f87171', borderRadius: '8px', padding: '12px 14px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div className="admin-onboarding-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 430px) minmax(0, 1fr)', gap: '18px', alignItems: 'start' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, fontSize: '13px', fontWeight: 700, color: Y, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Request queue
            </div>

            {loading ? (
              <div style={{ padding: '22px 18px', color: T3, fontSize: '13px' }}>Loading requests...</div>
            ) : requests.length === 0 ? (
              <div style={{ padding: '32px 18px', color: T3, fontSize: '13px', textAlign: 'center' }}>No onboarding requests yet.</div>
            ) : (
              requests.map(request => {
                const badge = statusBadge[request.status] ?? { bg: '#1f1f1f', color: '#cbd5e1' }
                const active = request.id === selectedId

                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => setSelectedId(request.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 16px',
                      border: 'none',
                      borderBottom: `1px solid ${BORDER}`,
                      background: active ? '#1b1b1b' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: T1, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                          {request.business_name}
                        </div>
                        {request.owner_name && (
                          <div style={{ fontSize: '12px', color: T2, marginTop: '3px', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                            {request.owner_name}
                          </div>
                        )}
                      </div>
                      <span style={{ background: badge.bg, color: badge.color, padding: '4px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>
                        {request.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: T2, marginBottom: '4px', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      {request.owner_email}
                    </div>
                    <div style={{ fontSize: '11px', color: T3, lineHeight: 1.6 }}>
                      {request.desired_slug ? `Preferred website name: ${request.desired_slug}` : 'No preferred website name'}
                    </div>
                    <div style={{ fontSize: '11px', color: T3, lineHeight: 1.6 }}>
                      {request.plan_interest || 'No plan interest'} • {request.invite_status} • {fmtDate(request.created_at)}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
            {!selected ? (
              <div style={{ padding: '40px 24px', color: T3, fontSize: '14px', textAlign: 'center' }}>
                Select a request to review details.
              </div>
            ) : (
              <>
                <div style={{ padding: '18px 20px', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontFamily: 'Georgia,serif', fontSize: '22px', fontStyle: 'italic', color: T1, marginBottom: '6px' }}>
                        {selected.business_name}
                      </div>
                      <div style={{ fontSize: '12px', color: T3 }}>
                        Submitted {fmtDate(selected.created_at)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <select
                        value={selected.status}
                        onChange={e => updateStatus(e.target.value)}
                        disabled={statusSaving === selected.id}
                        style={{
                          padding: '9px 12px',
                          background: '#111',
                          border: `1px solid ${BORDER}`,
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '13px',
                          fontFamily: 'sans-serif',
                        }}
                      >
                        {STATUS_OPTIONS.map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled
                        style={{
                          padding: '10px 14px',
                          borderRadius: '6px',
                          border: `1px solid ${BORDER}`,
                          background: '#111',
                          color: '#666',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'not-allowed',
                        }}
                      >
                        Create tenant + invite owner — coming next
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '0 20px 20px' }}>
                  <div className="admin-onboarding-detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0 18px' }}>
                    <DetailRow label="Owner name" value={selected.owner_name} />
                    <DetailRow label="Owner email" value={selected.owner_email} />
                    <DetailRow label="Owner phone" value={selected.owner_phone} />
                    <DetailRow label="Business phone" value={selected.business_phone} />
                    <DetailRow label="Business email" value={selected.business_email} />
                    <DetailRow label="Service area" value={selected.service_area} />
                    <DetailRow label="Preferred website name" value={selected.desired_slug} />
                    <DetailRow label="Plan interest" value={selected.plan_interest} />
                    <DetailRow label="Invite status" value={selected.invite_status} />
                    <DetailRow label="Tenant id" value={selected.tenant_id} />
                    <DetailRow label="Brand color" value={selected.brand_color} />
                    <DetailRow label="Business address" value={selected.business_address} />
                    <DetailRow label="Google review URL" value={selected.google_review_url} />
                    <DetailRow label="Yelp review URL" value={selected.yelp_review_url} />
                    <DetailRow label="Auto-create error" value={selected.auto_create_error} />
                  </div>

                  <DetailRow label="Services" value={selected.services_text} multiline />
                  <DetailRow label="Business hours" value={selected.business_hours_text} multiline />
                  <DetailRow label="Notes" value={selected.notes} multiline />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
