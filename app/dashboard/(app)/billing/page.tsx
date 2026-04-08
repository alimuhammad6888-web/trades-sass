'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useTenant } from '@/lib/tenant-context'
import { useThemeTokens } from '@/lib/theme'
import { hasFeature, resolvePlanName } from '@/lib/features'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Plan = 'starter' | 'pro' | 'enterprise'

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

const PLAN_OPTIONS: { plan: Plan; label: string; description: string; price: string }[] = [
  {
    plan:        'starter',
    label:       'Starter',
    description: 'Website, booking, and email confirmations.',
    price:       'Free',
  },
  {
    plan:        'pro',
    label:       'Pro',
    description: 'Everything in Starter plus payments, SMS, and custom domain.',
    price:       '$49/mo',
  },
  {
    plan:        'enterprise',
    label:       'Enterprise',
    description: 'Everything in Pro plus AI chatbot, staff management, and advanced CRM.',
    price:       '$99/mo',
  },
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function formatPlanLabel(plan: string | null | undefined): string {
  const canonical = resolvePlanName(plan)
  if (!canonical) return 'No plan'
  const labels: Record<string, string> = {
    starter:    'Starter Plan',
    pro:        'Pro Plan',
    enterprise: 'Enterprise Plan',
  }
  return labels[canonical] ?? 'No plan'
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
      borderRadius:   '4px',
      background:     'linear-gradient(90deg, #1e1e1e 25%, #2a2a2a 50%, #1e1e1e 75%)',
      backgroundSize: '200% 100%',
      animation:      'shimmer 1.5s infinite',
    }} />
  )
}

export default function BillingPage() {
  const { tenant } = useTenant()
  const T = useThemeTokens()

  const [billing, setBilling]         = useState<BillingRow | null>(null)
  const [loading, setLoading]         = useState(true)
  const [checkingPlan, setCheckingPlan] = useState<Plan | null>(null)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [checkoutResult, setCheckoutResult] = useState<string | null>(null)

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

  async function startCheckout(plan: Plan) {
    if (!tenant?.id) return
    setCheckingPlan(plan)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Session expired — please log in again.')
        setCheckingPlan(null)
        return
      }
      const res = await fetch('/api/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ tenant_id: tenant.id, plan }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Failed to start checkout.')
        setCheckingPlan(null)
        return
      }
      window.location.href = data.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
      setCheckingPlan(null)
    }
  }

  async function openBillingPortal() {
    if (!tenant?.id) return
    setOpeningPortal(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Session expired — please log in again.')
        setOpeningPortal(false)
        return
      }
      const res = await fetch('/api/billing/portal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ tenant_id: tenant.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Failed to open billing portal.')
        setOpeningPortal(false)
        return
      }
      window.location.href = data.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
      setOpeningPortal(false)
    }
  }

  const isActive   = billing?.billing_enabled && billing?.status === 'active'
  const renewLabel = billing?.cancel_at_period_end ? 'Cancels on' : 'Renews on'
  const dateToShow = billing?.status === 'trial'
    ? billing?.trial_ends_at
    : billing?.current_period_end

  const paymentsEnabled = hasFeature(tenant, 'payments')
  const planLabel       = formatPlanLabel(tenant?.plan)

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

        {/* ── Platform subscription card ────────────────────── */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: T.t1 }}>Current plan</span>
            {loading ? <SkeletonLine width="60px" height="22px" /> : billing ? <StatusBadge status={billing.status} /> : null}
          </div>

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
                  Choose a plan below to get started.
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '26px', fontWeight: 800, color: T.t1, marginBottom: '16px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {planLabel}
                </div>
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

        {/* ── Action area: manage (active) or plan chooser (inactive) ── */}
        {loading ? (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
            <SkeletonLine width="140px" height="36px" />
          </div>
        ) : isActive ? (
          /* Active: Stripe Customer Portal */
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', color: T.t3, marginBottom: '14px', lineHeight: 1.6 }}>
              Update your payment method, download invoices, or cancel your subscription from the billing portal.
            </div>
            <button
              onClick={openBillingPortal}
              disabled={openingPortal || !tenant?.id}
              style={{
                padding:       '10px 20px',
                fontSize:      '13px',
                fontWeight:    600,
                fontFamily:    'sans-serif',
                borderRadius:  '6px',
                border:        'none',
                background:    openingPortal ? T.border : (T.isDark ? '#F4C300' : '#1a1917'),
                color:         T.isDark ? '#000' : '#fff',
                cursor:        openingPortal || !tenant?.id ? 'not-allowed' : 'pointer',
                opacity:       openingPortal || !tenant?.id ? 0.6 : 1,
                transition:    'opacity 0.15s, background 0.15s',
                letterSpacing: '0.02em',
              }}
            >
              {openingPortal ? 'Opening portal…' : 'Manage plan & billing'}
            </button>
          </div>
        ) : (
          /* Not active: plan chooser */
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.t3, marginBottom: '12px' }}>
              Choose a plan
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {PLAN_OPTIONS.map(({ plan, label, description, price }) => {
                const isChecking  = checkingPlan === plan
                const anyChecking = checkingPlan !== null
                return (
                  <div
                    key={plan}
                    style={{
                      background:     T.card,
                      border:         `1px solid ${T.border}`,
                      borderRadius:   '10px',
                      padding:        '16px 20px',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'space-between',
                      gap:            '16px',
                      opacity:        anyChecking && !isChecking ? 0.5 : 1,
                      transition:     'opacity 0.15s',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: T.t1, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {label}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: T.t3 }}>
                          {price}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.5 }}>
                        {description}
                      </div>
                    </div>
                    <button
                      onClick={() => startCheckout(plan)}
                      disabled={anyChecking || !tenant?.id}
                      style={{
                        flexShrink:    0,
                        padding:       '8px 18px',
                        fontSize:      '12px',
                        fontWeight:    700,
                        fontFamily:    'sans-serif',
                        borderRadius:  '6px',
                        border:        'none',
                        background:    isChecking ? T.border : (T.isDark ? '#F4C300' : '#1a1917'),
                        color:         T.isDark ? '#000' : '#fff',
                        cursor:        anyChecking || !tenant?.id ? 'not-allowed' : 'pointer',
                        opacity:       !tenant?.id ? 0.5 : 1,
                        transition:    'opacity 0.15s, background 0.15s',
                        letterSpacing: '0.02em',
                        whiteSpace:    'nowrap',
                      }}
                    >
                      {isChecking ? 'Redirecting…' : `Get ${label}`}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Section divider ───────────────────────────────── */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.t3 }}>
            Customer Payments
          </div>
        </div>

        {/* ── Customer payments card ────────────────────────── */}
        {paymentsEnabled ? (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '10px', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: T.t1 }}>Customer Payments</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: '#0d2b1e', color: '#34d399' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                Enabled
              </span>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: '13px', color: T.t3, lineHeight: 1.6 }}>
                Payments setup coming soon.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '10px', overflow: 'hidden', marginBottom: '24px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '16px', right: '20px' }}>
              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: '#2a1f00', color: '#F4C300' }}>
                Included in Pro
              </span>
            </div>
            <div style={{ padding: '20px', paddingRight: '110px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: T.t1, marginBottom: '6px' }}>
                Accept payments from customers
              </div>
              <div style={{ fontSize: '13px', color: T.t3, lineHeight: 1.6, marginBottom: '16px' }}>
                Get paid online when customers book your services.
              </div>
            </div>
            <div style={{ paddingLeft: '20px', paddingRight: '20px', paddingBottom: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {[
                  'Online payments at booking',
                  'SMS confirmations',
                  'Custom domain',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: T.t2 }}>
                    <span style={{ color: '#34d399', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {item}
                  </div>
                ))}
              </div>
              <div style={{ borderTop: `1px solid ${T.border}`, marginBottom: '16px' }} />
              <button
                onClick={() => startCheckout('pro')}
                disabled={checkingPlan !== null || !tenant?.id}
                style={{
                  padding:       '10px 24px',
                  fontSize:      '13px',
                  fontWeight:    700,
                  fontFamily:    'sans-serif',
                  borderRadius:  '6px',
                  border:        'none',
                  background:    checkingPlan !== null ? T.border : (T.isDark ? '#F4C300' : '#1a1917'),
                  color:         T.isDark ? '#000' : '#fff',
                  cursor:        checkingPlan !== null || !tenant?.id ? 'not-allowed' : 'pointer',
                  opacity:       checkingPlan !== null || !tenant?.id ? 0.6 : 1,
                  transition:    'opacity 0.15s, background 0.15s',
                  letterSpacing: '0.02em',
                }}
              >
                {checkingPlan === 'pro' ? 'Redirecting to checkout…' : 'Upgrade to Pro'}
              </button>
            </div>
          </div>
        )}

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