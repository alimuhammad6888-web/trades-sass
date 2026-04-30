'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { resolvePlanName } from '@/lib/features'
import { useTenant } from '@/lib/tenant-context'
import { useThemeTokens } from '@/lib/theme'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type CampaignRow = {
  id: string
  name: string
  channel: 'email' | 'sms'
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
  subject: string | null
  message_body: string
  cta_url: string | null
  cta_label: string | null
  recipient_count: number
  delivered_count: number
  clicked_count: number
  failed_count: number
  created_at: string
  sent_at: string | null
}

type BuilderDraft = {
  name: string
  channel: 'email' | 'sms'
  subject: string
  message_body: string
  cta_url: string
  cta_label: string
}

const EMPTY_DRAFT: BuilderDraft = {
  name: '',
  channel: 'email',
  subject: '',
  message_body: '',
  cta_url: '',
  cta_label: '',
}

const STEPS = ['Channel', 'Message', 'Audience', 'Review'] as const

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getStatusStyles(status: CampaignRow['status']) {
  if (status === 'sent') return { bg: '#0d2b1e', color: '#34d399' }
  if (status === 'failed') return { bg: '#2a0d0d', color: '#f87171' }
  if (status === 'sending') return { bg: '#2a1f00', color: '#F4C300' }
  if (status === 'scheduled') return { bg: '#1c2232', color: '#93c5fd' }
  return { bg: '#1a1a1a', color: '#cccccc' }
}

export default function CampaignsPage() {
  const { tenant } = useTenant()
  const T = useThemeTokens()

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState<BuilderDraft>(EMPTY_DRAFT)

  const canonicalPlan = resolvePlanName(tenant?.plan) ?? 'starter'
  // TODO: Replace this with the canonical campaigns feature flag once sending is wired.
  const canSendCampaigns = canonicalPlan === 'enterprise'
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId) ?? null

  async function loadCampaigns() {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setError('Session expired — please log in again.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/campaigns', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setError(data?.error ?? 'Failed to load campaigns.')
      setLoading(false)
      return
    }

    const rows = Array.isArray(data?.campaigns) ? data.campaigns : []
    setCampaigns(rows)
    setLoading(false)
  }

  useEffect(() => {
    if (!tenant?.id) return
    loadCampaigns().catch(err => {
      console.error('[campaigns page] load error:', err)
      setError('Failed to load campaigns.')
      setLoading(false)
    })
  }, [tenant?.id])

  useEffect(() => {
    if (!selectedCampaign) return

    setDraft({
      name: selectedCampaign.name ?? '',
      channel: selectedCampaign.channel ?? 'email',
      subject: selectedCampaign.subject ?? '',
      message_body: selectedCampaign.message_body ?? '',
      cta_url: selectedCampaign.cta_url ?? '',
      cta_label: selectedCampaign.cta_label ?? '',
    })
  }, [selectedCampaignId])

  function updateDraft<K extends keyof BuilderDraft>(key: K, value: BuilderDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }))
  }

  function startNewCampaign() {
    setSelectedCampaignId(null)
    setDraft(EMPTY_DRAFT)
    setStepIndex(0)
    setError(null)
    setSuccess(null)
  }

  async function saveDraft() {
    setSaving(true)
    setError(null)
    setSuccess(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setError('Session expired — please log in again.')
      setSaving(false)
      return
    }

    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name: draft.name,
        channel: draft.channel,
        subject: draft.subject,
        message_body: draft.message_body,
        cta_url: draft.cta_url || undefined,
        cta_label: draft.cta_label || undefined,
        audience_type: 'all_customers',
      }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setError(data?.error ?? 'Failed to save campaign draft.')
      setSaving(false)
      return
    }

    const created = data?.campaign as CampaignRow | undefined
    if (created) {
      setCampaigns(current => [created, ...current])
      setSelectedCampaignId(created.id)
      setDraft({
        name: created.name,
        channel: created.channel,
        subject: created.subject ?? '',
        message_body: created.message_body,
        cta_url: created.cta_url ?? '',
        cta_label: created.cta_label ?? '',
      })
    }

    setSuccess('Draft saved.')
    setSaving(false)
  }

  const reviewCtaVisible = Boolean(draft.cta_url.trim())

  const validation = useMemo(() => {
    return {
      name: draft.name.trim().length > 0,
      subject: draft.subject.trim().length > 0,
      message: draft.message_body.trim().length > 0,
      ctaPair:
        (draft.cta_url.trim().length === 0 && draft.cta_label.trim().length === 0) ||
        (draft.cta_url.trim().length > 0 && draft.cta_label.trim().length > 0),
    }
  }, [draft])

  const ctr = (row: CampaignRow) =>
    row.delivered_count > 0
      ? `${Math.round((row.clicked_count / row.delivered_count) * 100)}%`
      : '—'

  const panelTitle = selectedCampaign ? 'Campaign details' : 'Campaign builder'

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: 'sans-serif', transition: 'background 0.2s' }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '16px',
          }}
        >
          <div>
            <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '22px', fontStyle: 'italic', color: T.t1, margin: 0 }}>
              Campaigns
            </h1>
            <p style={{ fontSize: '13px', color: T.t3, margin: '6px 0 0' }}>
              Reach customers with safe, trackable email campaigns
            </p>
          </div>

          <button
            onClick={startNewCampaign}
            type="button"
            style={{
              padding: '10px 18px',
              borderRadius: '6px',
              border: 'none',
              background: '#F4C300',
              color: '#000',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            New campaign
          </button>
        </div>

        {!canSendCampaigns && (
          <div
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderLeft: '3px solid #F4C300',
              borderRadius: '8px',
              padding: '14px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: T.t1, marginBottom: '4px' }}>
                Campaign sending is available on Enterprise.
              </div>
              <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.6 }}>
                You can build and preview campaigns here, but upgrading is required to send.
              </div>
            </div>

            <Link
              href="/dashboard/billing"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 14px',
                borderRadius: '6px',
                background: '#F4C300',
                color: '#000',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Upgrade to Enterprise
            </Link>
          </div>
        )}

        {error && (
          <div
            style={{
              background: T.isDark ? '#2a0d0d' : '#fdf0ef',
              border: `1px solid ${T.isDark ? '#5c1a1a' : '#f2c8c5'}`,
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '16px',
              color: '#f87171',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              background: T.isDark ? '#0d2b1e' : '#edf9f2',
              border: `1px solid ${T.isDark ? '#1a5c3a' : '#b7e4c7'}`,
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '16px',
              color: '#34d399',
              fontSize: '13px',
            }}
          >
            {success}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
            gap: '16px',
          }}
        >
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: T.t1 }}>Campaign list</div>
              <div style={{ fontSize: '12px', color: T.t3, marginTop: '4px' }}>
                Draft, review, and sent campaign history
              </div>
            </div>

            <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '18px', color: T.t3, fontSize: '13px' }}>Loading campaigns...</div>
              ) : campaigns.length === 0 ? (
                <div style={{ padding: '18px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: T.t1, marginBottom: '6px' }}>
                    No campaigns yet
                  </div>
                  <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.6 }}>
                    Start your first email campaign to draft messaging, preview the experience, and get ready for sending.
                  </div>
                </div>
              ) : (
                campaigns.map(campaign => {
                  const styles = getStatusStyles(campaign.status)
                  const active = campaign.id === selectedCampaignId

                  return (
                    <button
                      key={campaign.id}
                      type="button"
                      onClick={() => {
                        setSelectedCampaignId(campaign.id)
                        setStepIndex(3)
                        setError(null)
                        setSuccess(null)
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '16px 18px',
                        border: 'none',
                        borderBottom: `1px solid ${T.divider}`,
                        background: active ? T.hover : T.card,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: T.t1 }}>{campaign.name}</div>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            background: styles.bg,
                            color: styles.color,
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'capitalize',
                          }}
                        >
                          {campaign.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '11px', color: T.t3, marginBottom: '10px' }}>
                        {campaign.channel.toUpperCase()} {campaign.subject ? `• ${campaign.subject}` : ''}
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                          gap: '8px',
                          marginBottom: '10px',
                        }}
                      >
                        {[
                          ['Recipients', String(campaign.recipient_count ?? 0)],
                          ['Delivered', String(campaign.delivered_count ?? 0)],
                          ['Clicks', String(campaign.clicked_count ?? 0)],
                          ['CTR', ctr(campaign)],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <div style={{ fontSize: '10px', color: T.label, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              {label}
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: T.t1, marginTop: '3px' }}>
                              {value}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ fontSize: '11px', color: T.t3 }}>
                        Created {formatDate(campaign.created_at)}
                        {campaign.sent_at ? ` • Sent ${formatDate(campaign.sent_at)}` : ''}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: T.t1 }}>{panelTitle}</div>
                <div style={{ fontSize: '12px', color: T.t3, marginTop: '4px' }}>
                  Build the campaign in steps and review it before sending is unlocked.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', borderBottom: `1px solid ${T.border}` }}>
                {STEPS.map((step, index) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setStepIndex(index)}
                    style={{
                      padding: '12px 10px',
                      border: 'none',
                      borderRight: index < STEPS.length - 1 ? `1px solid ${T.border}` : 'none',
                      background: stepIndex === index ? T.hover : T.card,
                      color: stepIndex === index ? T.t1 : T.t3,
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {index + 1}. {step}
                  </button>
                ))}
              </div>

              <div style={{ padding: '18px' }}>
                {stepIndex === 0 && (
                  <div>
                    <div style={{ fontSize: '10px', color: T.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                      Step 1
                    </div>
                    <h2 style={{ fontSize: '16px', color: T.t1, margin: '0 0 10px' }}>Choose a channel</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => updateDraft('channel', 'email')}
                        style={{
                          padding: '16px',
                          borderRadius: '8px',
                          border: draft.channel === 'email' ? '1px solid #F4C300' : `1px solid ${T.border}`,
                          background: draft.channel === 'email' ? T.hover : T.card,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: 700, color: T.t1, marginBottom: '4px' }}>Email</div>
                        <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.6 }}>
                          Enabled in this MVP. Safe, individual sends with unsubscribe support.
                        </div>
                      </button>

                      <div
                        style={{
                          padding: '16px',
                          borderRadius: '8px',
                          border: `1px solid ${T.border}`,
                          background: T.card,
                          opacity: 0.7,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: T.t1 }}>SMS</div>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#F4C300', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Coming soon
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.6 }}>
                          SMS campaigns and opt-out handling will be added in the next phase.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {stepIndex === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: T.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                        Step 2
                      </div>
                      <h2 style={{ fontSize: '16px', color: T.t1, margin: '0 0 6px' }}>Write the message</h2>
                      <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.6 }}>
                        Each customer receives this individually — emails are never shared.
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: T.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                        Campaign name
                      </label>
                      <input
                        value={draft.name}
                        onChange={e => updateDraft('name', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${T.inputBorder}`,
                          background: T.input,
                          color: T.t1,
                          fontSize: '13px',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                        placeholder="Spring service reminder"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: T.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                        Email subject
                      </label>
                      <input
                        value={draft.subject}
                        onChange={e => updateDraft('subject', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${T.inputBorder}`,
                          background: T.input,
                          color: T.t1,
                          fontSize: '13px',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                        placeholder="A quick offer for returning customers"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: T.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                        Message body
                      </label>
                      <textarea
                        value={draft.message_body}
                        onChange={e => updateDraft('message_body', e.target.value)}
                        rows={8}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '6px',
                          border: `1px solid ${T.inputBorder}`,
                          background: T.input,
                          color: T.t1,
                          fontSize: '13px',
                          boxSizing: 'border-box',
                          outline: 'none',
                          resize: 'vertical',
                        }}
                        placeholder="We’ve opened up a few appointments this week and wanted to offer returning customers a quick booking window."
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: T.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                          CTA label
                        </label>
                        <input
                          value={draft.cta_label}
                          onChange={e => updateDraft('cta_label', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: `1px solid ${T.inputBorder}`,
                            background: T.input,
                            color: T.t1,
                            fontSize: '13px',
                            boxSizing: 'border-box',
                            outline: 'none',
                          }}
                          placeholder="Book now"
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: T.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                          CTA URL
                        </label>
                        <input
                          value={draft.cta_url}
                          onChange={e => updateDraft('cta_url', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: `1px solid ${T.inputBorder}`,
                            background: T.input,
                            color: T.t1,
                            fontSize: '13px',
                            boxSizing: 'border-box',
                            outline: 'none',
                          }}
                          placeholder="https://example.com/book"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {stepIndex === 2 && (
                  <div>
                    <div style={{ fontSize: '10px', color: T.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                      Step 3
                    </div>
                    <h2 style={{ fontSize: '16px', color: T.t1, margin: '0 0 8px' }}>Audience</h2>
                    <div
                      style={{
                        background: T.hover,
                        border: `1px solid ${T.border}`,
                        borderRadius: '8px',
                        padding: '14px 16px',
                        marginBottom: '12px',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 700, color: T.t1, marginBottom: '4px' }}>
                        All eligible customers
                      </div>
                      <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.6 }}>
                        Audience preview will exclude customers without email and unsubscribed customers.
                      </div>
                    </div>

                    <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.7 }}>
                      Segmentation, saved audiences, and scheduled sends can come next. For this MVP, the builder is focused on safe all-customer campaigns only.
                    </div>
                  </div>
                )}

                {stepIndex === 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: T.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                        Step 4
                      </div>
                      <h2 style={{ fontSize: '16px', color: T.t1, margin: '0 0 6px' }}>Review</h2>
                      <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.6 }}>
                        This will be sent individually to each eligible customer.
                      </div>
                    </div>

                    <div
                      style={{
                        border: `1px solid ${T.border}`,
                        borderRadius: '8px',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}`, background: T.hover }}>
                        <div style={{ fontSize: '11px', color: T.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                          Email preview
                        </div>
                        <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.6 }}>
                          From: {tenant?.name ?? 'Your business'}
                        </div>
                        <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.6 }}>
                          Subject: {draft.subject.trim() || 'Your subject will appear here'}
                        </div>
                      </div>

                      <div style={{ padding: '16px 14px', background: T.card }}>
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: T.t1, lineHeight: 1.7, marginBottom: reviewCtaVisible ? '16px' : 0 }}>
                          {draft.message_body.trim() || 'Your message body will appear here.'}
                        </div>

                        {reviewCtaVisible && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 16px', borderRadius: '6px', background: '#F4C300', color: '#000', fontSize: '12px', fontWeight: 700 }}>
                            {draft.cta_label.trim() || 'Open link'}
                          </div>
                        )}
                      </div>
                    </div>

                    {!validation.ctaPair && (
                      <div
                        style={{
                          background: T.isDark ? '#2a1f00' : '#fff8e1',
                          border: `1px solid ${T.isDark ? '#5c4400' : '#f3d27a'}`,
                          borderRadius: '8px',
                          padding: '12px 14px',
                          color: '#F4C300',
                          fontSize: '12px',
                          lineHeight: 1.6,
                        }}
                      >
                        Add both CTA label and CTA URL together, or leave both blank.
                      </div>
                    )}

                    {!canSendCampaigns ? (
                      <div
                        style={{
                          background: T.card,
                          border: `1px solid ${T.border}`,
                          borderLeft: '3px solid #F4C300',
                          borderRadius: '8px',
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: T.t1, marginBottom: '4px' }}>
                            Upgrade required to send campaigns.
                          </div>
                          <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.6 }}>
                            Drafts and previews are ready now. Sending unlocks on Enterprise.
                          </div>
                        </div>

                        <Link
                          href="/dashboard/billing"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '8px 14px',
                            borderRadius: '6px',
                            background: '#F4C300',
                            color: '#000',
                            fontSize: '12px',
                            fontWeight: 700,
                            textDecoration: 'none',
                          }}
                        >
                          Upgrade
                        </Link>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: T.card,
                          border: `1px solid ${T.border}`,
                          borderRadius: '8px',
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: T.t1, marginBottom: '4px' }}>
                            Send flow comes next.
                          </div>
                          <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.6 }}>
                            The campaign builder is ready. Actual sending and recipient resolution will be wired in the next step.
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled
                          style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#F4C300',
                            color: '#000',
                            fontSize: '12px',
                            fontWeight: 700,
                            opacity: 0.55,
                            cursor: 'not-allowed',
                          }}
                        >
                          Send coming next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: '16px 18px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setStepIndex(current => Math.max(0, current - 1))}
                    disabled={stepIndex === 0}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '6px',
                      border: `1px solid ${T.border}`,
                      background: T.card,
                      color: T.t1,
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: stepIndex === 0 ? 'not-allowed' : 'pointer',
                      opacity: stepIndex === 0 ? 0.5 : 1,
                    }}
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={() => setStepIndex(current => Math.min(STEPS.length - 1, current + 1))}
                    disabled={stepIndex === STEPS.length - 1}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#F4C300',
                      color: '#000',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: stepIndex === STEPS.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: stepIndex === STEPS.length - 1 ? 0.5 : 1,
                    }}
                  >
                    Next
                  </button>
                </div>

                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={
                    saving ||
                    draft.channel !== 'email' ||
                    !validation.name ||
                    !validation.subject ||
                    !validation.message ||
                    !validation.ctaPair
                  }
                  style={{
                    padding: '9px 14px',
                    borderRadius: '6px',
                    border: `1px solid ${T.border}`,
                    background: T.hover,
                    color: T.t1,
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor:
                      saving ||
                      draft.channel !== 'email' ||
                      !validation.name ||
                      !validation.subject ||
                      !validation.message ||
                      !validation.ctaPair
                        ? 'not-allowed'
                        : 'pointer',
                    opacity:
                      saving ||
                      draft.channel !== 'email' ||
                      !validation.name ||
                      !validation.subject ||
                      !validation.message ||
                      !validation.ctaPair
                        ? 0.5
                        : 1,
                  }}
                >
                  {saving ? 'Saving...' : 'Save draft'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
