'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useTenant } from '@/lib/tenant-context'
import { useThemeTokens } from '@/lib/theme'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Types ─────────────────────────────────────────────────────

type ConversationStatus = 'new' | 'waiting_you' | 'waiting_customer' | 'resolved'

const VALID_STATUSES = new Set<string>(['new', 'waiting_you', 'waiting_customer', 'resolved'])

type Conversation = {
  id:         string
  name:       string
  preview:    string
  time:       string
  status:     ConversationStatus
  avatar:     string
  channel:    'sms' | 'email' | 'booking' | 'web'
  unread:     boolean
  customerId: string
  email:      string | null
  phone:      string | null
}

type RawCustomer = {
  id:                   string
  first_name:           string | null
  last_name:            string | null
  email:                string | null
  phone:                string | null
  created_at:           string
  lead_source:          string | null
  inbox_status:         string | null
  inbox_snoozed_until:  string | null
  inbox_last_action_at: string | null
}

type RawBooking = {
  id:          string
  customer_id: string
  status:      string
  created_at:  string
}

// ── Helpers ───────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  <  1) return 'Just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  <  7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function buildName(c: RawCustomer): string {
  const first = c.first_name?.trim() ?? ''
  const last  = c.last_name?.trim()  ?? ''
  if (first || last) return `${first} ${last}`.trim()
  return c.email ?? c.phone ?? 'Unknown'
}

const ACTION_NEEDED_STATUSES = new Set(['pending', 'requested', 'new', 'unconfirmed'])

function deriveStatus(booking: RawBooking | undefined, refDate: string): ConversationStatus {
  if (booking) {
    const normalised = booking.status.toLowerCase().trim()
    if (ACTION_NEEDED_STATUSES.has(normalised)) return 'waiting_you'
  }
  const ageMs = Date.now() - new Date(refDate).getTime()
  if (ageMs < 24 * 60 * 60 * 1000) return 'new'
  return 'waiting_customer'
}

function mapToConversation(customer: RawCustomer, booking: RawBooking | undefined): Conversation {
  const name = buildName(customer)

  const refDate = booking && booking.created_at > customer.created_at
    ? booking.created_at
    : customer.created_at

  const channel: Conversation['channel'] = booking ? 'booking' : 'web'

  let preview: string
  if (booking) {
    const statusLabel: Record<string, string> = {
      pending:   'Booking request pending confirmation',
      confirmed: 'Upcoming appointment confirmed',
      completed: 'Recent service completed',
      cancelled: 'Booking was cancelled',
    }
    preview = statusLabel[booking.status.toLowerCase().trim()] ?? 'Recent booking activity'
  } else {
    const leadMap: Record<string, string> = {
      chatbot:  'Reached out via chatbot',
      referral: 'Referred by existing customer',
      website:  'New customer added to CRM',
    }
    preview = leadMap[customer.lead_source?.toLowerCase() ?? ''] ?? 'Customer added to CRM'
  }

  // Use persisted inbox_status if valid, otherwise derive from booking/timestamp
  const persistedStatus = customer.inbox_status ?? null
  const status: ConversationStatus =
    persistedStatus && VALID_STATUSES.has(persistedStatus)
      ? (persistedStatus as ConversationStatus)
      : deriveStatus(booking, refDate)

  const unread = status === 'new' || status === 'waiting_you'

  return {
    id:         customer.id,
    name,
    preview,
    time:       timeAgo(refDate),
    status,
    avatar:     initials(name),
    channel,
    unread,
    customerId: customer.id,
    email:      customer.email ?? null,
    phone:      customer.phone ?? null,
  }
}

// ── Constants ─────────────────────────────────────────────────

const STATUS_CONFIG: Record<ConversationStatus, { label: string; bg: string; color: string }> = {
  new:              { label: 'New',             bg: '#0d2b1e', color: '#34d399' },
  waiting_you:      { label: 'Waiting on you',  bg: '#2a1f00', color: '#F4C300' },
  waiting_customer: { label: 'Waiting on them', bg: '#1a1a2a', color: '#818cf8' },
  resolved:         { label: 'Resolved',        bg: '#1a1a1a', color: '#555'    },
}

const CHANNEL_ICON: Record<Conversation['channel'], string> = {
  sms:     '📱',
  email:   '✉️',
  booking: '📋',
  web:     '🌐',
}

type FilterKey = 'All' | 'New' | 'Need reply' | 'Waiting'

// ── Page ──────────────────────────────────────────────────────

export default function InboxPage() {
  const { tenant } = useTenant()
  const T          = useThemeTokens()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading]             = useState(true)
  const [fetchError, setFetchError]       = useState<string | null>(null)
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [filter, setFilter]               = useState<FilterKey>('All')
  const [saving, setSaving]               = useState(false)

  // ── Fetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (!tenant?.id) return

    let mounted = true
    setLoading(true)
    setFetchError(null)

    async function load() {
      const { data: customers, error: custErr } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone, created_at, lead_source, inbox_status, inbox_snoozed_until, inbox_last_action_at')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!mounted) return

      if (custErr) {
        console.error('[inbox] customers fetch error:', custErr.message)
        setFetchError('Failed to load conversations.')
        setLoading(false)
        return
      }

      if (!customers || customers.length === 0) {
        setConversations([])
        setLoading(false)
        return
      }

      const customerIds = customers.map(c => c.id)

      const { data: bookings, error: bookErr } = await supabase
        .from('bookings')
        .select('id, customer_id, status, created_at')
        .eq('tenant_id', tenant!.id)
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })

      if (!mounted) return

      if (bookErr) {
        console.warn('[inbox] bookings fetch warning:', bookErr.message)
      }

      const bookingMap = new Map<string, RawBooking>()
      for (const b of (bookings ?? [])) {
        if (!bookingMap.has(b.customer_id)) {
          bookingMap.set(b.customer_id, b)
        }
      }

      const mapped = (customers as RawCustomer[]).map(c =>
        mapToConversation(c, bookingMap.get(c.id))
      )

      setConversations(mapped)
      setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [tenant?.id])

  // ── Actions ───────────────────────────────────────────────

  function applyLocalUpdate(customerId: string, patch: Partial<Conversation>) {
    setConversations(prev => prev.map(c =>
      c.id === customerId ? { ...c, ...patch } : c
    ))
  }

  async function handleMarkResolved() {
    if (!selectedId || saving) return
    setSaving(true)
    setFetchError(null)

    const { error } = await supabase
      .from('customers')
      .update({
        inbox_status:         'resolved',
        inbox_last_action_at: new Date().toISOString(),
        inbox_snoozed_until:  null,
      })
      .eq('id', selectedId)

    if (error) {
      console.error('[inbox] mark resolved error:', error.message)
      setFetchError('Failed to update conversation. Please try again.')
      setSaving(false)
      return
    }

    applyLocalUpdate(selectedId, { status: 'resolved', unread: false })

    // Clear selection if resolved is not visible under current filter
    if (filter !== 'All') {
      setSelectedId(null)
    }

    setSaving(false)
  }

  async function handleSnooze() {
    if (!selectedId || saving) return
    setSaving(true)
    setFetchError(null)

    const { error } = await supabase
      .from('customers')
      .update({
        inbox_status:         'waiting_customer',
        inbox_last_action_at: new Date().toISOString(),
      })
      .eq('id', selectedId)

    if (error) {
      console.error('[inbox] snooze error:', error.message)
      setFetchError('Failed to update conversation. Please try again.')
      setSaving(false)
      return
    }

    applyLocalUpdate(selectedId, { status: 'waiting_customer', unread: false })

    // Clear selection if waiting_customer is not visible under current filter
    if (filter === 'New' || filter === 'Need reply') {
      setSelectedId(null)
    }

    setSaving(false)
  }

  // ── Derived state ─────────────────────────────────────────

  const filtered = conversations.filter(c => {
    if (filter === 'All')        return true
    if (filter === 'New')        return c.status === 'new'
    if (filter === 'Need reply') return c.status === 'waiting_you'
    if (filter === 'Waiting')    return c.status === 'waiting_customer'
    return true
  })

  const selected        = filtered.find(c => c.id === selectedId) ?? null
  const newCount        = conversations.filter(c => c.status === 'new').length
  const waitingYouCount = conversations.filter(c => c.status === 'waiting_you').length
  const unreadCount     = conversations.filter(c => c.unread).length

  const FILTERS: FilterKey[] = ['All', 'New', 'Need reply', 'Waiting']

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: 'sans-serif', transition: 'background 0.2s', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .conv-row:hover { background: ${T.isDark ? '#161616' : '#f8f5f0'} !important; }
        .conv-row.selected { background: ${T.isDark ? '#1e1e1e' : '#f0ede6'} !important; border-left: 3px solid #F4C300 !important; }
        @media (max-width: 768px) { .inbox-split { flex-direction: column !important; } .inbox-main { display: none !important; } }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ padding: '20px 24px 0', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'italic', color: T.t1, marginBottom: '4px' }}>
              Inbox
            </h1>
            <p style={{ fontSize: '13px', color: T.t3 }}>
              Manage customer conversations, leads, and follow-ups in one place
            </p>
          </div>
          {!loading && conversations.length > 0 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {newCount > 0 && (
                <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: '#0d2b1e', color: '#34d399' }}>
                  {newCount} New
                </span>
              )}
              {waitingYouCount > 0 && (
                <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: '#2a1f00', color: '#F4C300' }}>
                  {waitingYouCount} Need reply
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Split layout ── */}
      <div className="inbox-split" style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, height: 'calc(100vh - 87px)' }}>

        {/* ── Left: conversation list ── */}
        <div style={{ width: '320px', flexShrink: 0, borderRight: `1px solid ${T.border}`, overflowY: 'auto', background: T.bg, display: 'flex', flexDirection: 'column' }}>

          {/* Filter row */}
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => { setFilter(f); setSelectedId(null) }} style={{
                padding:      '4px 10px',
                borderRadius: '20px',
                fontSize:     '11px',
                fontWeight:   500,
                fontFamily:   'sans-serif',
                border:       `1px solid ${filter === f ? T.t1 : T.border}`,
                background:   filter === f ? T.t1 : 'transparent',
                color:        filter === f ? (T.isDark ? '#000' : '#fff') : T.t3,
                cursor:       'pointer',
              }}>
                {f}
              </button>
            ))}
          </div>

          {/* List body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(90deg, #1e1e1e 25%, #2a2a2a 50%, #1e1e1e 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ height: '13px', width: '60%', borderRadius: '4px', background: 'linear-gradient(90deg, #1e1e1e 25%, #2a2a2a 50%, #1e1e1e 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                      <div style={{ height: '11px', width: '85%', borderRadius: '4px', background: 'linear-gradient(90deg, #1e1e1e 25%, #2a2a2a 50%, #1e1e1e 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && fetchError && (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
                <div style={{ fontSize: '13px', color: T.t3 }}>{fetchError}</div>
              </div>
            )}

            {!loading && !fetchError && conversations.length === 0 && (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>📭</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: T.t1, marginBottom: '6px' }}>No customers yet</div>
                <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.6 }}>
                  Customers will appear here once bookings come in or are added manually.
                </div>
              </div>
            )}

            {!loading && !fetchError && conversations.length > 0 && filtered.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: T.t3 }}>No conversations match this filter.</div>
              </div>
            )}

            {!loading && filtered.map(conv => {
              const statusCfg  = STATUS_CONFIG[conv.status]
              const isSelected = conv.id === selectedId
              return (
                <div
                  key={conv.id}
                  className={`conv-row${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelectedId(conv.id)}
                  style={{
                    padding:      '14px 16px',
                    borderBottom: `1px solid ${T.border}`,
                    cursor:       'pointer',
                    background:   isSelected ? (T.isDark ? '#1e1e1e' : '#f0ede6') : 'transparent',
                    borderLeft:   isSelected ? '3px solid #F4C300' : '3px solid transparent',
                    transition:   'background 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{
                      width:          '36px',
                      height:         '36px',
                      borderRadius:   '50%',
                      background:     T.isDark ? '#2a2a2a' : '#e8e4dc',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      fontSize:       '11px',
                      fontWeight:     700,
                      color:          T.t2,
                      flexShrink:     0,
                      position:       'relative',
                    }}>
                      {conv.avatar}
                      {conv.unread && (
                        <span style={{ position: 'absolute', top: '-1px', right: '-1px', width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', border: `2px solid ${T.bg}` }} />
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                        <span style={{ fontSize: '13px', fontWeight: conv.unread ? 600 : 500, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.name}
                        </span>
                        <span style={{ fontSize: '10px', color: T.t3, flexShrink: 0, marginLeft: '8px' }}>{conv.time}</span>
                      </div>

                      <div style={{ fontSize: '12px', color: T.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '6px' }}>
                        {CHANNEL_ICON[conv.channel]} {conv.preview}
                      </div>

                      <span style={{
                        display:       'inline-flex',
                        alignItems:    'center',
                        gap:           '4px',
                        padding:       '2px 7px',
                        borderRadius:  '20px',
                        fontSize:      '10px',
                        fontWeight:    600,
                        letterSpacing: '0.03em',
                        background:    statusCfg.bg,
                        color:         statusCfg.color,
                      }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusCfg.color, display: 'inline-block' }} />
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right: main panel ── */}
        <div className="inbox-main" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {selected ? (

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

              {/* Conversation header */}
              <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.bg, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: T.isDark ? '#2a2a2a' : '#e8e4dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: T.t2 }}>
                    {selected.avatar}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: T.t1 }}>{selected.name}</div>
                    <div style={{ fontSize: '11px', color: T.t3, marginTop: '1px' }}>
                      {CHANNEL_ICON[selected.channel]} via {selected.channel} · {selected.time}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleMarkResolved}
                    disabled={saving || selected.status === 'resolved'}
                    style={{
                      padding:      '6px 12px',
                      fontSize:     '12px',
                      fontWeight:   500,
                      fontFamily:   'sans-serif',
                      borderRadius: '6px',
                      border:       `1px solid ${T.border}`,
                      background:   'transparent',
                      color:        saving || selected.status === 'resolved' ? T.t3 : T.t2,
                      cursor:       saving || selected.status === 'resolved' ? 'not-allowed' : 'pointer',
                      opacity:      saving || selected.status === 'resolved' ? 0.5 : 1,
                      transition:   'opacity 0.15s',
                    }}
                  >
                    {saving ? 'Saving…' : selected.status === 'resolved' ? 'Resolved ✓' : 'Mark resolved'}
                  </button>
                  <button
                    onClick={handleSnooze}
                    disabled={saving}
                    style={{
                      padding:      '6px 12px',
                      fontSize:     '12px',
                      fontWeight:   500,
                      fontFamily:   'sans-serif',
                      borderRadius: '6px',
                      border:       `1px solid ${T.border}`,
                      background:   'transparent',
                      color:        saving ? T.t3 : T.t2,
                      cursor:       saving ? 'not-allowed' : 'pointer',
                      opacity:      saving ? 0.5 : 1,
                      transition:   'opacity 0.15s',
                    }}
                  >
                    Snooze
                  </button>
                </div>
              </div>

              {/* Contact info strip */}
              {(selected.email || selected.phone) && (
                <div style={{ padding: '10px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: '20px', background: T.isDark ? '#111' : '#f8f6f1', flexShrink: 0 }}>
                  {selected.phone && (
                    <span style={{ fontSize: '12px', color: T.t3 }}>📞 {selected.phone}</span>
                  )}
                  {selected.email && (
                    <span style={{ fontSize: '12px', color: T.t3 }}>✉️ {selected.email}</span>
                  )}
                </div>
              )}

              {/* Inline save error */}
              {fetchError && saving === false && (
                <div style={{ padding: '10px 24px', background: '#2a0d0d', borderBottom: `1px solid #5c1a1a`, fontSize: '12px', color: '#f87171', flexShrink: 0 }}>
                  {fetchError}
                </div>
              )}

              {/* Message thread area */}
              <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: T.isDark ? '#2a2a2a' : '#e8e4dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: T.t2, flexShrink: 0 }}>
                    {selected.avatar}
                  </div>
                  <div style={{ maxWidth: '72%' }}>
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '0 12px 12px 12px', padding: '12px 14px', fontSize: '13px', color: T.t1, lineHeight: 1.55 }}>
                      {selected.preview}
                    </div>
                    <div style={{ fontSize: '10px', color: T.t3, marginTop: '4px' }}>{selected.time}</div>
                  </div>
                </div>

                <div style={{ background: T.isDark ? '#111' : '#f8f6f1', border: `1px solid ${T.border}`, borderRadius: '8px', padding: '12px 16px', fontSize: '12px', color: T.t3, lineHeight: 1.6 }}>
                  💡 <strong style={{ color: T.t2 }}>AI summary coming soon</strong> — full SMS/email threading, auto-reply suggestions, and booking actions will appear here.
                </div>

                <div style={{ marginTop: 'auto', background: T.card, border: `1px solid ${T.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                  <textarea
                    placeholder={`Reply to ${selected.name}…`}
                    rows={3}
                    style={{
                      width:      '100%',
                      padding:    '14px 16px',
                      background: 'transparent',
                      border:     'none',
                      outline:    'none',
                      fontSize:   '13px',
                      color:      T.t1,
                      fontFamily: 'sans-serif',
                      resize:     'none',
                      boxSizing:  'border-box',
                    }}
                  />
                  <div style={{ padding: '10px 14px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {['📎', '😊', '📋'].map(icon => (
                        <button key={icon} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', opacity: 0.5, padding: '2px 4px' }}>{icon}</button>
                      ))}
                    </div>
                    <button style={{
                      padding:      '7px 16px',
                      fontSize:     '12px',
                      fontWeight:   600,
                      fontFamily:   'sans-serif',
                      borderRadius: '6px',
                      border:       'none',
                      background:   T.isDark ? '#F4C300' : '#1a1917',
                      color:        T.isDark ? '#000' : '#fff',
                      cursor:       'pointer',
                    }}>
                      Send reply
                    </button>
                  </div>
                </div>
              </div>
            </div>

          ) : (

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', textAlign: 'center', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.5 }}>📬</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: T.t1, marginBottom: '6px' }}>
                  Select a conversation to view details
                </div>
                <div style={{ fontSize: '13px', color: T.t3, maxWidth: '300px', lineHeight: 1.6 }}>
                  Your customer messages, booking requests, and follow-ups all live here.
                </div>
              </div>

              <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>

                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '10px', padding: '18px 20px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.t3, marginBottom: '12px' }}>
                    Recent Activity
                  </div>
                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[...Array(3)].map((_, i) => (
                        <div key={i} style={{ height: '12px', borderRadius: '4px', background: 'linear-gradient(90deg, #1e1e1e 25%, #2a2a2a 50%, #1e1e1e 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {conversations.slice(0, 3).map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.status === 'new' ? '#34d399' : c.status === 'waiting_you' ? '#F4C300' : '#818cf8', flexShrink: 0, marginTop: '5px' }} />
                          <div>
                            <div style={{ fontSize: '12px', color: T.t1 }}>{c.name}</div>
                            <div style={{ fontSize: '10px', color: T.t3 }}>{c.time}</div>
                          </div>
                        </div>
                      ))}
                      {conversations.length === 0 && (
                        <div style={{ fontSize: '12px', color: T.t3 }}>No activity yet</div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '10px', padding: '18px 20px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.t3, marginBottom: '12px' }}>
                    Follow-up Queue
                  </div>
                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[...Array(3)].map((_, i) => (
                        <div key={i} style={{ height: '12px', borderRadius: '4px', background: 'linear-gradient(90deg, #1e1e1e 25%, #2a2a2a 50%, #1e1e1e 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {conversations.filter(c => c.status === 'waiting_you').slice(0, 3).map(c => (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '12px', color: T.t1 }}>{c.name}</div>
                          <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '20px', background: '#2a1f00', color: '#F4C300' }}>
                            Needs reply
                          </span>
                        </div>
                      ))}
                      {conversations.filter(c => c.status === 'waiting_you').length === 0 && (
                        <div style={{ fontSize: '12px', color: T.t3 }}>All caught up ✓</div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '10px', padding: '18px 20px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.t3, marginBottom: '12px' }}>
                    Unread Messages
                  </div>
                  {loading ? (
                    <div style={{ height: '36px', width: '60px', borderRadius: '4px', background: 'linear-gradient(90deg, #1e1e1e 25%, #2a2a2a 50%, #1e1e1e 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                  ) : (
                    <>
                      <div style={{ fontSize: '36px', fontWeight: 800, color: T.t1, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '-0.01em', marginBottom: '4px' }}>
                        {unreadCount}
                      </div>
                      <div style={{ fontSize: '12px', color: T.t3, marginBottom: '14px' }}>
                        across {conversations.length} contacts
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {[
                          { label: 'New leads',  count: newCount,        color: '#34d399' },
                          { label: 'Need reply', count: waitingYouCount, color: '#F4C300' },
                        ].map(row => (
                          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: T.t3 }}>{row.label}</span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: row.color }}>{row.count}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div style={{ padding: '0 24px 24px' }}>
                <div style={{ background: T.isDark ? '#111' : '#f8f6f1', border: `1px solid ${T.border}`, borderRadius: '10px', padding: '16px 20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: T.t2, marginBottom: '8px' }}>🚀 Coming soon to Inbox</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {['Two-way SMS', 'Email threading', 'AI reply suggestions', 'Booking actions', 'Notes & tags'].map(item => (
                      <span key={item} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: T.isDark ? '#1a1a1a' : '#ece8e0', color: T.t3 }}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}