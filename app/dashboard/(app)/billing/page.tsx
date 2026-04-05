'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useTenant } from '@/lib/tenant-context'
import { useThemeTokens } from '@/lib/theme'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type BillingRow = {
  status:                 string
  billing_enabled:        boolean
  trial_ends_at:          string | null
  current_period_end:     string | null
  stripe_customer_id:     string | null
  stripe_subscription_id: string | null
  stripe_price_id:        string | null
  cancel_at_period_end:   boolean
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { label: string; bg: string; color: string }> = {
    active:    { label: 'Active',    bg: '#0d2b1e', color: '#34d399' },
    trial:     { label: 'Trial',     bg: '#2a1f00', color: '#F4C300' },
    past_due:  { label: 'Past due',  bg: '#2a0d0d', color: '#f87171' },
    suspended: { label: 'Suspended', bg: '#1a1a1a', color: '#888'    },
  }
  const s = styles[status] ?? { label: status, bg: '#1a1a1a', color: '#888' }
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           '6px',
      padding:       '4px 12px',
      borderRadius:  '20px',
      fontSize:      '12px',
      fontWeight:    600,
      letterSpacing: '0.04em',
      background:    s.bg,
      color:         s.color,
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color, display: 'inline-block' }} />
      {s.label}
    </span>
  )
}

function SkeletonLine({ width = '100%', height = '16px' }: { width?: string; height?: string }) {
  return (
    <div style={{
      width, height,
      borderRadius: '4px',
      background: 'linear-gradient(90deg, #1e1e1e 25%, #2a2a2a 50%, #1e1e1e 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  )
}

export default function BillingPage() {
  const { tenant } = useTenant()
  const T = useThemeTokens()

  const [billing, setBilling]   = useState<BillingRow | null>(null)
  const [loading, setLoading]   = useState(true)
  const [checking, setChecking] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [checkoutResult, setCheckoutResult] = useState<string | null>(null)

  // Read URL param client-side only to avoid hydration mismatch
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('checkout')
    setCheckoutResult(param)
  }, [])

  useEffect(() => {
    if (!tenant?.id) return
    supabase
      .from('tenant_billing')
      .select('status, billing_enabled, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id, stripe_price_id, cancel_at_period_end')
      .eq('tenant_id', tenant.id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) console.error('[billing page] fetch error:', err.message)
        setBilling(data ?? null)
        setLoading(false)
      })
  }, [tenant?.id])

  async function startCheckout() {
    if (!tenant?.id) return
    setChecking(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Session expired — please log in again.')
        setChecking(false)
        return
      }
      const res = await fetch('/api/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ tenant_id: tenant.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Failed to start checkout.')
        setChecking(false)
        return
      }
      window.location.href = data.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
      setChecking(false)
    }
  }

  const isActive    = billing?.billing_enabled && billing?.status === 'active'
  const renewLabel  = billing?.cancel_at_period_end ? 'Cancels on' : 'Renews on'
  const dateToShow  = billing?.status === 'trial'
  ? billing?.trial_ends_at
  : billing?.current_period_end
    ? billing.trial_ends_at
    : billing?.current_period_end

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: 'sans-serif', transition: 'background 0.2s' }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
      `}</style>

      <div style={{ padding: '28px 24px', maxWidth: '520px' }}>

        {/* Page header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.t3, marginBottom: '6px' }}>
            Account
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontStyle: 'italic', color: T.t1, margin: 0 }}>
            Billing
          </h1>
        </div>

        {/* Feedback banners */}
        {checkoutResult === 'success' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0d2b1e', border: '1px solid #1a5c3a', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
            <span style={{ fontSize: '16px' }}>✓</span>
            <span style={{ fontSize: '13px', color: '#34d399', fontWeight: 500 }}>Subscription activated. You're all set.</span>
          </div>
        )}
        {checkoutResult === 'cancel' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
            <span style={{ fontSize: '16px' }}>↩</span>
            <span style={{ fontSize: '13px', color: T.t3 }}>Checkout cancelled — no changes were made.</span>
          </div>
        )}
        {error && (
          <div style={{ background: '#2a0d0d', border: '1px solid #5c1a1a', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* Plan card */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>

          {/* Card header */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: T.t1 }}>Current plan</span>
            {loading ? <SkeletonLine width="60px" height="22px" /> : billing ? <StatusBadge status={billing.status} /> : null}
          </div>

          {/* Card body */}
          <div style={{ padding: '20px' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <SkeletonLine width="140px" height="28px" />
                <SkeletonLine width="180px" height="14px" />
                <SkeletonLine width="120px" height="14px" />
              </div>
            ) : !billing ? (
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: T.t1, marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  No plan
                </div>
                <div style={{ fontSize: '13px', color: T.t3 }}>
                  Subscribe to unlock all dashboard features.
                </div>
              </div>
            ) : (
              <>
                {/* Plan name */}
                <div style={{ fontSize: '26px', fontWeight: 800, color: T.t1, marginBottom: '16px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Pro Plan
                </div>

                {/* Divider rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {[
                    { label: renewLabel, val: formatDate(dateToShow) },
                    { label: 'Billing cycle', val: 'Monthly' },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ fontSize: '12px', color: T.t3, fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: '13px', color: T.t1, fontWeight: 600 }}>{val}</span>
                    </div>
                  ))}
                </div>

                {billing.cancel_at_period_end && (
                  <div style={{ marginTop: '14px', background: '#2a1f00', border: '1px solid #5c4400', borderRadius: '6px', padding: '10px 14px', fontSize: '12px', color: '#F4C300', lineHeight: 1.5 }}>
                    Your subscription is set to cancel at the end of the billing period.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Action card */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
          {loading ? (
            <SkeletonLine width="140px" height="36px" />
          ) : isActive ? (
            <div>
              <div style={{ fontSize: '13px', color: T.t3, marginBottom: '14px', lineHeight: 1.6 }}>
                To update payment details, cancel, or change your plan — contact support. A self-serve portal is coming soon.
              </div>
              <button
                disabled
                style={{ padding: '10px 20px', fontSize: '13px', fontWeight: 600, fontFamily: 'sans-serif', borderRadius: '6px', border: `1px solid ${T.border}`, background: 'transparent', color: T.t3, cursor: 'not-allowed', opacity: 0.5 }}
              >
                Manage billing (coming soon)
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '13px', color: T.t3, marginBottom: '14px', lineHeight: 1.6 }}>
                Start your subscription to unlock all features.
              </div>
              <button
                onClick={startCheckout}
                disabled={checking || loading || !tenant?.id}
                style={{
                  padding:    '10px 24px',
                  fontSize:   '13px',
                  fontWeight: 700,
                  fontFamily: 'sans-serif',
                  borderRadius: '6px',
                  border:     'none',
                  background: checking ? T.border : (T.isDark ? '#F4C300' : '#1a1917'),
                  color:      T.isDark ? '#000' : '#fff',
                  cursor:     checking || loading ? 'not-allowed' : 'pointer',
                  opacity:    checking || !tenant?.id ? 0.6 : 1,
                  transition: 'opacity 0.15s, background 0.15s',
                  letterSpacing: '0.02em',
                }}
              >
                {checking ? 'Redirecting to checkout…' : 'Start subscription'}
              </button>
            </div>
          )}
        </div>

        {/* Back link */}
        <Link
          href="/dashboard"
          style={{ fontSize: '12px', color: T.t3, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'color 0.15s' }}
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  )
}