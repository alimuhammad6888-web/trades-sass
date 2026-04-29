'use client'

import { useEffect, useState } from 'react'

type SmsLimitRow = {
  id?: string
  plan: 'starter' | 'pro' | 'enterprise'
  monthly_sms_limit: number
}

function isSmsLimitRow(value: unknown): value is SmsLimitRow {
  if (!value || typeof value !== 'object') return false

  const row = value as Record<string, unknown>

  return (
    (row.plan === 'starter' || row.plan === 'pro' || row.plan === 'enterprise') &&
    typeof row.monthly_sms_limit === 'number' &&
    Number.isInteger(row.monthly_sms_limit) &&
    row.monthly_sms_limit >= 0
  )
}

const BG = '#0f0f0f'
const CARD = '#161616'
const BORDER = '#2e2e2e'
const Y = '#F4C300'
const T1 = '#ffffff'
const T2 = '#a0a0a0'
const T3 = '#666666'

const DEFAULT_LIMITS: SmsLimitRow[] = [
  { plan: 'starter', monthly_sms_limit: 0 },
  { plan: 'pro', monthly_sms_limit: 250 },
  { plan: 'enterprise', monthly_sms_limit: 2000 },
]

const inp: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: '#111',
  border: `1px solid ${BORDER}`,
  borderRadius: '6px',
  color: '#fff',
  fontSize: '14px',
  fontFamily: 'sans-serif',
  boxSizing: 'border-box',
  outline: 'none',
}

function getAdminKey(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('admin_key')
}

export default function SmsLimitsPage() {
  const [limits, setLimits] = useState<SmsLimitRow[]>(DEFAULT_LIMITS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const adminKey = getAdminKey()

    if (!adminKey) {
      setError('Admin session expired. Go back to /admin and re-authenticate.')
      setLoading(false)
      return
    }

    fetch('/api/admin/sms-limits', {
      headers: { 'x-admin-key': adminKey },
    })
      .then(async res => {
        const data = await res.json().catch(() => null)

        if (!res.ok) {
          throw new Error(data?.error ?? 'Failed to load SMS limits')
        }

        const rows = Array.isArray(data?.limits) ? data.limits.filter(isSmsLimitRow) : []
        if (rows.length > 0) {
          const byPlan = new Map<SmsLimitRow['plan'], SmsLimitRow>(
            rows.map(row => [row.plan, row] as const)
          )
          setLimits(
            DEFAULT_LIMITS.map((row): SmsLimitRow => byPlan.get(row.plan) ?? row)
          )
        }

        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load SMS limits')
        setLoading(false)
      })
  }, [])

  function updateLimit(plan: SmsLimitRow['plan'], value: string) {
    const parsed = value === '' ? 0 : Number.parseInt(value, 10)

    setLimits(current =>
      current.map(row =>
        row.plan === plan
          ? { ...row, monthly_sms_limit: Number.isNaN(parsed) ? 0 : parsed }
          : row
      )
    )
  }

  async function handleSave() {
    const adminKey = getAdminKey()

    if (!adminKey) {
      setError('Admin session expired. Go back to /admin and re-authenticate.')
      return
    }

    for (const row of limits) {
      if (!Number.isInteger(row.monthly_sms_limit) || row.monthly_sms_limit < 0) {
        setError(`Monthly SMS limit for ${row.plan} must be an integer >= 0.`)
        return
      }
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/sms-limits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({
          limits: limits.map(row => ({
            plan: row.plan,
            monthly_sms_limit: row.monthly_sms_limit,
          })),
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to save SMS limits')
      }

      const rows = Array.isArray(data?.limits) ? data.limits.filter(isSmsLimitRow) : []
      if (rows.length > 0) {
        const byPlan = new Map<SmsLimitRow['plan'], SmsLimitRow>(
          rows.map(row => [row.plan, row] as const)
        )
        setLimits(
          DEFAULT_LIMITS.map((row): SmsLimitRow => byPlan.get(row.plan) ?? row)
        )
      }

      setSuccess('SMS limits saved.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save SMS limits')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: T1, fontFamily: 'sans-serif' }}>
      <div
        style={{
          background: '#111',
          borderBottom: `3px solid ${Y}`,
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontFamily: 'Georgia,serif', fontSize: '20px', color: Y, fontStyle: 'italic' }}>
          Admin Portal
        </span>
        <span style={{ fontSize: '12px', color: T3 }}>Internal use only</span>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '28px 20px' }}>
        <a
          href="/admin"
          style={{ color: T2, fontSize: '12px', textDecoration: 'none', display: 'inline-block', marginBottom: '16px' }}
        >
          ← Back to admin
        </a>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '22px', margin: 0, fontStyle: 'italic' }}>
              SMS Limits
            </h1>
            <p style={{ fontSize: '13px', color: T3, margin: '4px 0 0' }}>
              Configure monthly SMS limits by plan.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={loading || saving}
            style={{
              padding: '10px 20px',
              background: Y,
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: loading || saving ? 'not-allowed' : 'pointer',
              opacity: loading || saving ? 0.6 : 1,
              fontFamily: 'sans-serif',
            }}
          >
            {saving ? 'Saving...' : 'Save limits'}
          </button>
        </div>

        {error && (
          <div
            style={{
              background: '#2a0d0d',
              border: '1px solid #5c1a1a',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#f87171',
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              background: '#0d2b1e',
              border: '1px solid #1a5c3a',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#34d399',
            }}
          >
            {success}
          </div>
        )}

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 180px',
              padding: '10px 20px',
              borderBottom: `1px solid ${BORDER}`,
              fontSize: '11px',
              color: T3,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
            }}
          >
            <span>Plan</span>
            <span>Monthly SMS limit</span>
          </div>

          {loading ? (
            <div style={{ padding: '40px 20px', color: T3, fontSize: '14px' }}>Loading SMS limits...</div>
          ) : (
            limits.map(row => (
              <div
                key={row.plan}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 180px',
                  padding: '14px 20px',
                  borderBottom: `1px solid ${BORDER}`,
                  fontSize: '13px',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{row.plan}</div>
                  <div style={{ fontSize: '11px', color: T3, marginTop: '4px' }}>
                    Monthly outbound SMS send limit
                  </div>
                </div>

                <input
                  type="number"
                  min={0}
                  step={1}
                  value={row.monthly_sms_limit}
                  onChange={e => updateLimit(row.plan, e.target.value)}
                  style={inp}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
