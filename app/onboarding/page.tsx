'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type PlanOption = {
  key: 'starter' | 'pro' | 'enterprise'
  label: string
  priceLabel: string
  priceId: string | null
}

type FormState = {
  business_name: string
  owner_name: string
  owner_email: string
  owner_phone: string
  business_phone: string
  business_email: string
  service_area: string
  business_address: string
  preferred_website_name: string
  plan_interest: string
  google_review_url: string
  yelp_review_url: string
  notes: string
  website: string
}

const INITIAL_FORM: FormState = {
  business_name: '',
  owner_name: '',
  owner_email: '',
  owner_phone: '',
  business_phone: '',
  business_email: '',
  service_area: '',
  business_address: '',
  preferred_website_name: '',
  plan_interest: '',
  google_review_url: '',
  yelp_review_url: '',
  notes: '',
  website: '',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: '8px',
  border: '1px solid #d7dde7',
  background: '#ffffff',
  color: '#17202b',
  fontSize: '14px',
  fontFamily: 'sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#64748b',
}

const FALLBACK_PLANS: PlanOption[] = [
  { key: 'starter', label: 'Starter', priceLabel: 'Starter', priceId: null },
  { key: 'pro', label: 'Pro', priceLabel: 'Pro', priceId: null },
  { key: 'enterprise', label: 'Enterprise', priceLabel: 'Enterprise — Custom', priceId: null },
]

export default function OnboardingPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [plans, setPlans] = useState<PlanOption[]>(FALLBACK_PLANS)

  const canSubmit = useMemo(() => {
    return form.business_name.trim().length > 0 && form.owner_email.trim().length > 0
  }, [form.business_name, form.owner_email])

  useEffect(() => {
    let active = true

    async function loadPlans() {
      try {
        const res = await fetch('/api/pricing/plans')
        const data = await res.json().catch(() => null)

        if (!res.ok || !data?.plans || !Array.isArray(data.plans)) {
          return
        }

        if (!active) return

        setPlans(
          data.plans.map((plan: PlanOption) => ({
            key: plan.key,
            label: plan.label,
            priceLabel: plan.priceLabel,
            priceId: plan.priceId,
          }))
        )
      } catch {
        // Keep fallback pricing labels if pricing lookup fails.
      }
    }

    loadPlans()

    return () => {
      active = false
    }
  }, [])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || submitting) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/onboarding/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setError(data?.error ?? 'Failed to submit onboarding request.')
        setSubmitting(false)
        return
      }

      setSubmitted(true)
      setSubmitting(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit onboarding request.')
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fb', fontFamily: 'sans-serif', color: '#17202b' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px 80px' }}>
          <Link href="/for-businesses" style={{ color: '#64748b', fontSize: '13px', textDecoration: 'none' }}>
            ← Back
          </Link>

          <div
            style={{
              marginTop: '28px',
              background: '#ffffff',
              border: '1px solid #d7dde7',
              borderRadius: '16px',
              padding: '36px',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '999px',
                background: '#e8f5ee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px',
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#1a6b4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <h1 style={{ margin: '0 0 10px', fontSize: '32px', lineHeight: 1.05, fontWeight: 800 }}>
              Request received
            </h1>
            <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.7, color: '#556273', maxWidth: '60ch' }}>
              Thanks for sending your business details. We&apos;ll review the request and, if it&apos;s a fit, we&apos;ll email you a secure account setup link. No password is needed on this form.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb', fontFamily: 'sans-serif', color: '#17202b' }}>
      <style>{`
        @media (max-width: 1100px) {
          .onboarding-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }

        @media (max-width: 900px) {
          .onboarding-two-col,
          .onboarding-three-col {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 20px 80px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '24px',
          }}
        >
          <Link href="/for-businesses" style={{ color: '#64748b', fontSize: '13px', textDecoration: 'none' }}>
            ← Back
          </Link>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            If approved, we’ll email you a secure account setup link.
          </div>
        </div>

        <div
          className="onboarding-layout"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 0.78fr) minmax(260px, 0.42fr)',
            gap: '20px',
            alignItems: 'start',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #d7dde7',
              borderRadius: '16px',
              padding: '28px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: '10px' }}>
              Onboarding request
            </div>
            <h1 style={{ margin: '0 0 12px', fontSize: '34px', lineHeight: 1.05, fontWeight: 800 }}>
              Tell us what your business needs.
            </h1>
            <p style={{ margin: '0 0 24px', fontSize: '15px', lineHeight: 1.7, color: '#556273' }}>
              Share the basics for your business account. We&apos;ll review the request first, and if approved, we&apos;ll email you a secure account setup link.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="onboarding-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Business name *</label>
                  <input
                    value={form.business_name}
                    onChange={e => updateField('business_name', e.target.value)}
                    placeholder="Acme Plumbing"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Owner name</label>
                  <input
                    value={form.owner_name}
                    onChange={e => updateField('owner_name', e.target.value)}
                    placeholder="Jordan Smith"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="onboarding-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Owner email *</label>
                  <input
                    type="email"
                    value={form.owner_email}
                    onChange={e => updateField('owner_email', e.target.value)}
                    placeholder="owner@business.com"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Owner phone</label>
                  <input
                    value={form.owner_phone}
                    onChange={e => updateField('owner_phone', e.target.value)}
                    placeholder="(555) 000-0000"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="onboarding-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Business email</label>
                  <input
                    type="email"
                    value={form.business_email}
                    onChange={e => updateField('business_email', e.target.value)}
                    placeholder="hello@business.com"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Business phone</label>
                  <input
                    value={form.business_phone}
                    onChange={e => updateField('business_phone', e.target.value)}
                    placeholder="(555) 000-0000"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="onboarding-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Service area *</label>
                  <input
                    value={form.service_area}
                    onChange={e => updateField('service_area', e.target.value)}
                    placeholder="North Dallas, Plano, Frisco"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Plan interest *</label>
                  <select
                    value={form.plan_interest}
                    onChange={e => updateField('plan_interest', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Select a plan</option>
                    {plans.map(plan => (
                      <option key={plan.key} value={plan.key}>
                        {plan.priceLabel === plan.label
                          ? plan.label
                          : `${plan.label} — ${plan.priceLabel}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Business address</label>
                <input
                  value={form.business_address}
                  onChange={e => updateField('business_address', e.target.value)}
                  placeholder="123 Main St, Springfield, IL"
                  style={inputStyle}
                />
              </div>

              <div className="onboarding-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Preferred website name</label>
                  <input
                    value={form.preferred_website_name}
                    onChange={e => updateField('preferred_website_name', e.target.value)}
                    placeholder="acme-plumbing"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Google review URL</label>
                  <input
                    value={form.google_review_url}
                    onChange={e => updateField('google_review_url', e.target.value)}
                    placeholder="https://..."
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Yelp review URL</label>
                  <input
                    value={form.yelp_review_url}
                    onChange={e => updateField('yelp_review_url', e.target.value)}
                    placeholder="https://..."
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => updateField('notes', e.target.value)}
                  rows={4}
                  placeholder="Anything else we should know about setup, workflows, or launch timing?"
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'none' }}>
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  value={form.website}
                  onChange={e => updateField('website', e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {error && (
                <div
                  style={{
                    background: '#fdf0ef',
                    border: '1px solid #f2c8c5',
                    color: '#b0322a',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    fontSize: '13px',
                  }}
                >
                  {error}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6, maxWidth: '48ch' }}>
                  If approved, we’ll email you a secure account setup link. Payment is not collected on this form. If approved, we’ll confirm your plan before activating your account.
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6, maxWidth: '48ch' }}>
                  No password is collected here.
                </div>
                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  style={{
                    padding: '12px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#17202b',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: !canSubmit || submitting ? 'not-allowed' : 'pointer',
                    opacity: !canSubmit || submitting ? 0.55 : 1,
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit onboarding request'}
                </button>
              </div>
            </form>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #d7dde7',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
              Good to know
            </div>
            {[
              'This form does not create an account automatically.',
              'This form does not create a Supabase Auth user.',
              'If approved, we’ll email you a secure account setup link.',
            ].map(item => (
              <div key={item} style={{ fontSize: '14px', lineHeight: 1.7, color: '#556273' }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
