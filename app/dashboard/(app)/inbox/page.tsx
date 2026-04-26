'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { createClient } from '@supabase/supabase-js'
import { hasEntitledFeature } from '@/lib/entitlements'
import { useTenant } from '@/lib/tenant-context'
import { useThemeTokens } from '@/lib/theme'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type ConversationStatus = 'new' | 'waiting_you' | 'waiting_customer' | 'resolved'

const VALID_STATUSES = new Set<string>(['new', 'waiting_you', 'waiting_customer', 'resolved'])
const RETENTION_DAYS = 90
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000

type Conversation = {
  id: string
  name: string
  preview: string
  time: string
  status: ConversationStatus
  avatar: string
  channel: 'sms' | 'email' | 'booking' | 'web'
  unread: boolean
  customerId: string
  email: string | null
  phone: string | null
}

type RawCustomer = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  created_at: string
  lead_source: string | null
  inbox_status: string | null
  inbox_snoozed_until: string | null
  inbox_last_action_at: string | null
}

type RawBooking = {
  id: string
  customer_id: string
  status: string
  created_at: string
}

type InboxThread = {
  id: string
  customer_id: string | null
  last_message_at: string | null
  status: string | null
}

type InboxMessage = {
  id: string
  thread_id: string | null
  tenant_id: string | null
  customer_id: string | null
  direction: 'inbound' | 'outbound'
  channel: string
  subject: string | null
  body: string
  from_email: string | null
  to_email: string | null
  body_purged: boolean
  purged_at: string | null
  created_at: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function buildName(c: RawCustomer): string {
  const first = c.first_name?.trim() ?? ''
  const last = c.last_name?.trim() ?? ''
  if (first || last) return `${first} ${last}`.trim()
  return c.email ?? c.phone ?? 'Unknown'
}

const ACTION_NEEDED_STATUSES = new Set(['pending', 'requested', 'new', 'unconfirmed'])

function deriveStatus(booking: RawBooking | undefined, refDate: string): ConversationStatus {
  if (booking) {
    const normalized = booking.status.toLowerCase().trim()
    if (ACTION_NEEDED_STATUSES.has(normalized)) return 'waiting_you'
  }

  const ageMs = Date.now() - new Date(refDate).getTime()
  if (ageMs < 24 * 60 * 60 * 1000) return 'new'
  return 'waiting_customer'
}

function mapToConversation(customer: RawCustomer, booking: RawBooking | undefined): Conversation {
  const name = buildName(customer)

  const refDate =
    booking && booking.created_at > customer.created_at
      ? booking.created_at
      : customer.created_at

  const channel: Conversation['channel'] = booking ? 'booking' : 'web'

  let preview: string
  if (booking) {
    const statusLabel: Record<string, string> = {
      pending: 'Booking request pending confirmation',
      confirmed: 'Upcoming appointment confirmed',
      completed: 'Recent service completed',
      cancelled: 'Booking was cancelled',
    }
    preview = statusLabel[booking.status.toLowerCase().trim()] ?? 'Recent booking activity'
  } else {
    const leadMap: Record<string, string> = {
      chatbot: 'Reached out via chatbot',
      referral: 'Referred by existing customer',
      website: 'New customer added to CRM',
    }
    preview = leadMap[customer.lead_source?.toLowerCase() ?? ''] ?? 'Customer added to CRM'
  }

  const persistedStatus = customer.inbox_status ?? null
  const status: ConversationStatus =
    persistedStatus && VALID_STATUSES.has(persistedStatus)
      ? (persistedStatus as ConversationStatus)
      : deriveStatus(booking, refDate)

  const unread = status === 'new' || status === 'waiting_you'

  return {
    id: customer.id,
    name,
    preview,
    time: timeAgo(refDate),
    status,
    avatar: initials(name),
    channel,
    unread,
    customerId: customer.id,
    email: customer.email ?? null,
    phone: customer.phone ?? null,
  }
}

function normalizeMessage(row: Record<string, any>): InboxMessage {
  return {
    id: String(row.id),
    thread_id: row.thread_id ?? null,
    tenant_id: row.tenant_id ?? null,
    customer_id: row.customer_id ?? null,
    direction: row.direction === 'outbound' ? 'outbound' : 'inbound',
    channel: typeof row.channel === 'string' ? row.channel : 'web_form',
    subject: typeof row.subject === 'string' ? row.subject : null,
    body: typeof row.body === 'string' ? row.body : '',
    from_email: typeof row.from_email === 'string' ? row.from_email : null,
    to_email: typeof row.to_email === 'string' ? row.to_email : null,
    body_purged: row.body_purged === true,
    purged_at: typeof row.purged_at === 'string' ? row.purged_at : null,
    created_at: row.created_at ?? new Date().toISOString(),
  }
}

function getDaysRemaining(message: InboxMessage): number {
  if (message.body_purged) return 0
  const expiresAt = new Date(message.created_at).getTime() + RETENTION_MS
  const remaining = expiresAt - Date.now()
  if (remaining <= 0) return 0
  return Math.ceil(remaining / (24 * 60 * 60 * 1000))
}

function getRetentionTone(message: InboxMessage) {
  const daysRemaining = getDaysRemaining(message)
  const expired = message.body_purged || daysRemaining === 0
  return {
    daysRemaining,
    warning: !expired && daysRemaining < 7,
    expired,
  }
}

function channelLabel(channel: string): string {
  if (channel === 'web_form') return 'Web form'
  if (channel === 'email') return 'Email'
  return channel.replace(/_/g, ' ')
}

function sanitizeFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'inbox-export'
}

function csvEscape(value: string | null | undefined): string {
  const safe = value ?? ''
  return `"${safe.replace(/"/g, '""')}"`
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const STATUS_CONFIG: Record<ConversationStatus, { label: string; bg: string; color: string }> = {
  new: { label: 'New', bg: '#0d2b1e', color: '#34d399' },
  waiting_you: { label: 'Waiting on you', bg: '#2a1f00', color: '#F4C300' },
  waiting_customer: { label: 'Waiting on them', bg: '#1a1a2a', color: '#818cf8' },
  resolved: { label: 'Resolved', bg: '#1a1a1a', color: '#555' },
}

const CHANNEL_ICON: Record<Conversation['channel'], string> = {
  sms: '📱',
  email: '✉️',
  booking: '📋',
  web: '🌐',
}

type FilterKey = 'All' | 'New' | 'Need reply' | 'Waiting'

const FILTERS: FilterKey[] = ['All', 'New', 'Need reply', 'Waiting']

const shimmerStyle: CSSProperties = {
  background: 'linear-gradient(90deg, #1e1e1e 25%, #2a2a2a 50%, #1e1e1e 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '4px',
}

export default function InboxPage() {
  const { tenant, billing } = useTenant()
  const T = useThemeTokens()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('All')
  const [saving, setSaving] = useState(false)

  const [threads, setThreads] = useState<InboxThread[]>([])
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)

  const [replySubject, setReplySubject] = useState('Re: Inquiry')
  const [replyBody, setReplyBody] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [replyFeedback, setReplyFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const inboxEnabled = tenant ? hasEntitledFeature(tenant, billing, 'advanced_crm') : false
  const isLocked = tenant !== null && !inboxEnabled

  useEffect(() => {
    if (!tenant?.id) return

    let mounted = true
    setLoading(true)
    setFetchError(null)

    async function load() {
      const { data: customers, error: custErr } = await supabase
        .from('customers')
        .select(
          'id, first_name, last_name, email, phone, created_at, lead_source, inbox_status, inbox_snoozed_until, inbox_last_action_at'
        )
        .eq('tenant_id', tenant.id)
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
        .eq('tenant_id', tenant.id)
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })

      if (!mounted) return

      if (bookErr) {
        console.warn('[inbox] bookings fetch warning:', bookErr.message)
      }

      const bookingMap = new Map<string, RawBooking>()
      for (const b of bookings ?? []) {
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
    return () => {
      mounted = false
    }
  }, [tenant?.id])

  useEffect(() => {
    if (!tenant?.id || !selectedId) {
      setThreads([])
      setMessages([])
      setMessageError(null)
      setReplyFeedback(null)
      setReplySubject('Re: Inquiry')
      setReplyBody('')
      return
    }

    let mounted = true
    setMessagesLoading(true)
    setMessageError(null)
    setReplyFeedback(null)
    setReplySubject('Re: Inquiry')
    setReplyBody('')

    async function loadThreadHistory() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (!session?.access_token) {
        setThreads([])
        setMessages([])
        setMessageError('Session expired. Please log in again.')
        setMessagesLoading(false)
        return
      }

      const res = await fetch(
        `/api/inbox/thread-messages?customer_id=${encodeURIComponent(selectedId)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )

      const data = await res.json().catch(() => null)

      if (!mounted) return

      if (!res.ok) {
        console.error('[inbox] thread history fetch error:', data?.error ?? res.statusText)
        setThreads([])
        setMessages([])
        setMessageError(data?.error ?? 'Failed to load message history.')
        setMessagesLoading(false)
        return
      }

      const safeThreads = Array.isArray(data?.threads) ? (data.threads as InboxThread[]) : []
      const safeMessages = Array.isArray(data?.messages)
        ? data.messages.map(row => normalizeMessage(row as Record<string, any>))
        : []

      setThreads(safeThreads)
      setMessages(safeMessages)
      setMessagesLoading(false)
    }

    loadThreadHistory()

    return () => {
      mounted = false
    }
  }, [selectedId, tenant?.id])

  function applyLocalUpdate(customerId: string, patch: Partial<Conversation>) {
    setConversations(prev => prev.map(c => (c.id === customerId ? { ...c, ...patch } : c)))
  }

  async function runInboxAction(nextStatus: 'resolved' | 'waiting_customer') {
    if (!tenant?.id || !selectedId || saving || isLocked) return false

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setFetchError('Session expired. Please log in again.')
      return false
    }

    const res = await fetch('/api/inbox/actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        tenant_id: tenant.id,
        customer_id: selectedId,
        action: nextStatus === 'resolved' ? 'mark_resolved' : 'snooze',
      }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setFetchError(data?.error ?? 'Failed to update conversation. Please try again.')
      return false
    }

    return true
  }

  async function handleMarkResolved() {
    if (!selectedId || saving || isLocked) return

    setSaving(true)
    setFetchError(null)

    const ok = await runInboxAction('resolved')

    if (!ok) {
      setSaving(false)
      return
    }

    applyLocalUpdate(selectedId, { status: 'resolved', unread: false })

    if (filter !== 'All') setSelectedId(null)

    setSaving(false)
  }

  async function handleSnooze() {
    if (!selectedId || saving || isLocked) return

    setSaving(true)
    setFetchError(null)

    const ok = await runInboxAction('waiting_customer')

    if (!ok) {
      setSaving(false)
      return
    }

    applyLocalUpdate(selectedId, { status: 'waiting_customer', unread: false })

    if (filter === 'New' || filter === 'Need reply') setSelectedId(null)

    setSaving(false)
  }

  async function handleSendReply() {
    if (!selected || sendingReply || isLocked) return
    if (!selected.email) {
      setReplyFeedback({
        type: 'error',
        message: 'This customer does not have an email address on file.',
      })
      return
    }
    if (!replyBody.trim()) {
      setReplyFeedback({ type: 'error', message: 'Reply body is required.' })
      return
    }

    setSendingReply(true)
    setReplyFeedback(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setReplyFeedback({ type: 'error', message: 'Session expired. Please log in again.' })
      setSendingReply(false)
      return
    }

    const res = await fetch('/api/inbox/reply-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        customer_id: selected.customerId,
        subject: replySubject.trim() || 'Re: Inquiry',
        body: replyBody.trim(),
      }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setReplyFeedback({
        type: 'error',
        message: data?.error ?? 'Failed to send reply. Please try again.',
      })
      setSendingReply(false)
      return
    }

    if (data?.message) {
      setMessages(prev => [...prev, normalizeMessage(data.message as Record<string, any>)])
    }

    applyLocalUpdate(selected.customerId, {
      status: 'waiting_customer',
      unread: false,
      channel: 'email',
      preview: 'Sent email reply',
      time: 'Just now',
    })

    setReplyBody('')
    setReplySubject('Re: Inquiry')
    setReplyFeedback({ type: 'success', message: 'Reply sent successfully.' })
    setSendingReply(false)
  }

  function handleExportTxt() {
    if (!selected || messages.length === 0 || isLocked) return

    const content = messages
      .map(message => {
        const body = message.body_purged
          ? 'Message body expired due to retention policy.'
          : message.body
        return [
          '--- Message ---',
          `Date: ${fmtDateTime(message.created_at)}`,
          `From: ${message.from_email ?? ''}`,
          `To: ${message.to_email ?? ''}`,
          `Subject: ${message.subject ?? ''}`,
          `Body: ${body}`,
          '',
        ].join('\n')
      })
      .join('\n')

    downloadFile(
      `${sanitizeFileName(selected.name)}-inbox-history.txt`,
      content,
      'text/plain;charset=utf-8'
    )
  }

  function handleExportCsv() {
    if (!selected || messages.length === 0 || isLocked) return

    const lines = [
      'date,from,to,subject,body',
      ...messages.map(message => {
        const body = message.body_purged
          ? 'Message body expired due to retention policy.'
          : message.body
        return [
          csvEscape(fmtDateTime(message.created_at)),
          csvEscape(message.from_email),
          csvEscape(message.to_email),
          csvEscape(message.subject),
          csvEscape(body),
        ].join(',')
      }),
    ]

    downloadFile(
      `${sanitizeFileName(selected.name)}-inbox-history.csv`,
      lines.join('\n'),
      'text/csv;charset=utf-8'
    )
  }

  const filtered = conversations.filter(c => {
    if (filter === 'All') return true
    if (filter === 'New') return c.status === 'new'
    if (filter === 'Need reply') return c.status === 'waiting_you'
    if (filter === 'Waiting') return c.status === 'waiting_customer'
    return true
  })

  const selected = filtered.find(c => c.id === selectedId) ?? null
  const newCount = conversations.filter(c => c.status === 'new').length
  const waitingYouCount = conversations.filter(c => c.status === 'waiting_you').length
  const unreadCount = conversations.filter(c => c.unread).length

  const headerH = isLocked ? 134 : 87
  const exportDisabled = messages.length === 0 || isLocked

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        fontFamily: 'sans-serif',
        transition: 'background 0.2s',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        @keyframes pulse   { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .conv-row:hover    { background: ${T.isDark ? '#161616' : '#f8f5f0'} !important; }
        .conv-row.selected { background: ${T.isDark ? '#1e1e1e' : '#f0ede6'} !important; border-left: 3px solid #F4C300 !important; }
        @media (max-width: 768px) {
          .inbox-split { flex-direction: column !important; }
          .inbox-main  { display: none !important; }
        }
      `}</style>

      {isLocked && (
        <div
          style={{
            padding: '12px 24px',
            background: '#1a1400',
            borderBottom: '1px solid #3a2e00',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>🔒</span>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#F4C300' }}>
                Inbox is a Pro feature
              </span>
              <span style={{ fontSize: '13px', color: '#9a8040', marginLeft: '8px' }}>
                You can preview your contacts below. Upgrade to reply, resolve, and manage
                conversations.
              </span>
            </div>
          </div>

          <a
            href="/dashboard/billing"
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              background: '#F4C300',
              color: '#000',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
              flexShrink: 0,
              letterSpacing: '0.02em',
            }}
          >
            Upgrade to Pro
          </a>
        </div>
      )}

      <div style={{ padding: '20px 24px 0', borderBottom: `1px solid ${T.border}` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: '22px',
                fontStyle: 'italic',
                color: T.t1,
                marginBottom: '4px',
              }}
            >
              Inbox
            </h1>
            <p style={{ fontSize: '13px', color: T.t3 }}>
              Manage customer conversations, leads, and follow-ups in one place
            </p>
          </div>

          {!loading && conversations.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {newCount > 0 && (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: '#0d2b1e',
                    color: '#34d399',
                  }}
                >
                  {newCount} New
                </span>
              )}
              {waitingYouCount > 0 && (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: '#2a1f00',
                    color: '#F4C300',
                  }}
                >
                  {waitingYouCount} Need reply
                </span>
              )}
              {unreadCount > 0 && (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: T.isDark ? '#1f2937' : '#ece8df',
                    color: T.t2,
                  }}
                >
                  {unreadCount} Unread
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className="inbox-split"
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
          height: `calc(100vh - ${headerH}px)`,
        }}
      >
        <div
          style={{
            width: '320px',
            flexShrink: 0,
            borderRight: `1px solid ${T.border}`,
            background: T.bg,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: `1px solid ${T.border}`,
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f)
                  setSelectedId(null)
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 500,
                  fontFamily: 'sans-serif',
                  border: `1px solid ${filter === f ? T.t1 : T.border}`,
                  background: filter === f ? T.t1 : 'transparent',
                  color: filter === f ? (T.isDark ? '#000' : '#fff') : T.t3,
                  cursor: 'pointer',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid ${T.border}`,
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        ...shimmerStyle,
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ ...shimmerStyle, height: '13px', width: '60%' }} />
                      <div style={{ ...shimmerStyle, height: '11px', width: '85%' }} />
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
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: T.t1,
                    marginBottom: '6px',
                  }}
                >
                  No customers yet
                </div>
                <div style={{ fontSize: '12px', color: T.t3, lineHeight: 1.6 }}>
                  Customers will appear here once bookings come in or are added manually.
                </div>
              </div>
            )}

            {!loading && !fetchError && conversations.length > 0 && filtered.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: T.t3 }}>
                  No conversations match this filter.
                </div>
              </div>
            )}

            {!loading &&
              filtered.map(conv => {
                const statusCfg = STATUS_CONFIG[conv.status]
                const rowSelected = conv.id === selectedId

                return (
                  <div
                    key={conv.id}
                    className={`conv-row${rowSelected ? ' selected' : ''}`}
                    onClick={() => setSelectedId(conv.id)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid ${T.border}`,
                      cursor: 'pointer',
                      background: rowSelected
                        ? T.isDark
                          ? '#1e1e1e'
                          : '#f0ede6'
                        : 'transparent',
                      borderLeft: rowSelected
                        ? '3px solid #F4C300'
                        : '3px solid transparent',
                      transition: 'background 0.12s',
                      opacity: isLocked ? 0.7 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: T.isDark ? '#2a2a2a' : '#e8e4dc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: T.t2,
                          flexShrink: 0,
                          position: 'relative',
                        }}
                      >
                        {conv.avatar}
                        {conv.unread && (
                          <span
                            style={{
                              position: 'absolute',
                              top: '-1px',
                              right: '-1px',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: '#34d399',
                              border: `2px solid ${T.bg}`,
                            }}
                          />
                        )}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            marginBottom: '3px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: conv.unread ? 600 : 500,
                              color: T.t1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {conv.name}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              color: T.t3,
                              flexShrink: 0,
                              marginLeft: '8px',
                            }}
                          >
                            {conv.time}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: '12px',
                            color: T.t3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginBottom: '6px',
                          }}
                        >
                          {CHANNEL_ICON[conv.channel]} {conv.preview}
                        </div>

                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 7px',
                            borderRadius: '20px',
                            fontSize: '10px',
                            fontWeight: 600,
                            letterSpacing: '0.03em',
                            background: statusCfg.bg,
                            color: statusCfg.color,
                          }}
                        >
                          <span
                            style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              background: statusCfg.color,
                              display: 'inline-block',
                            }}
                          />
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        <div
          className="inbox-main"
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {selected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  padding: '16px 24px',
                  borderBottom: `1px solid ${T.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: T.bg,
                  flexShrink: 0,
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: T.isDark ? '#2a2a2a' : '#e8e4dc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: T.t2,
                    }}
                  >
                    {selected.avatar}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: T.t1 }}>
                      {selected.name}
                    </div>
                    <div style={{ fontSize: '11px', color: T.t3, marginTop: '1px' }}>
                      {CHANNEL_ICON[selected.channel]} via {selected.channel} · {selected.time}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleExportTxt}
                    disabled={exportDisabled}
                    title={isLocked ? 'Upgrade to Pro to export message history' : undefined}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      fontFamily: 'sans-serif',
                      borderRadius: '6px',
                      border: `1px solid ${T.border}`,
                      background: 'transparent',
                      color: exportDisabled ? T.t3 : T.t2,
                      cursor: exportDisabled ? 'not-allowed' : 'pointer',
                      opacity: exportDisabled ? 0.45 : 1,
                    }}
                  >
                    Export as TXT
                  </button>

                  <button
                    onClick={handleExportCsv}
                    disabled={exportDisabled}
                    title={isLocked ? 'Upgrade to Pro to export message history' : undefined}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      fontFamily: 'sans-serif',
                      borderRadius: '6px',
                      border: `1px solid ${T.border}`,
                      background: 'transparent',
                      color: exportDisabled ? T.t3 : T.t2,
                      cursor: exportDisabled ? 'not-allowed' : 'pointer',
                      opacity: exportDisabled ? 0.45 : 1,
                    }}
                  >
                    Export as CSV
                  </button>

                  <button
                    onClick={handleMarkResolved}
                    disabled={saving || selected.status === 'resolved' || isLocked}
                    title={isLocked ? 'Upgrade to Pro to use Inbox actions' : undefined}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      fontFamily: 'sans-serif',
                      borderRadius: '6px',
                      border: `1px solid ${T.border}`,
                      background: 'transparent',
                      color:
                        isLocked || saving || selected.status === 'resolved' ? T.t3 : T.t2,
                      cursor:
                        isLocked || saving || selected.status === 'resolved'
                          ? 'not-allowed'
                          : 'pointer',
                      opacity:
                        isLocked || saving || selected.status === 'resolved' ? 0.45 : 1,
                    }}
                  >
                    {saving
                      ? 'Saving…'
                      : selected.status === 'resolved'
                        ? 'Resolved ✓'
                        : isLocked
                          ? '🔒 Mark resolved'
                          : 'Mark resolved'}
                  </button>

                  <button
                    onClick={handleSnooze}
                    disabled={saving || isLocked}
                    title={isLocked ? 'Upgrade to Pro to use Inbox actions' : undefined}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      fontFamily: 'sans-serif',
                      borderRadius: '6px',
                      border: `1px solid ${T.border}`,
                      background: 'transparent',
                      color: isLocked || saving ? T.t3 : T.t2,
                      cursor: isLocked || saving ? 'not-allowed' : 'pointer',
                      opacity: isLocked || saving ? 0.45 : 1,
                    }}
                  >
                    {isLocked ? '🔒 Snooze' : 'Snooze'}
                  </button>
                </div>
              </div>

              {(selected.email || selected.phone) && (
                <div
                  style={{
                    padding: '10px 24px',
                    borderBottom: `1px solid ${T.border}`,
                    display: 'flex',
                    gap: '20px',
                    background: T.isDark ? '#111' : '#f8f6f1',
                    flexShrink: 0,
                    flexWrap: 'wrap',
                  }}
                >
                  {selected.phone && (
                    <span style={{ fontSize: '12px', color: T.t3 }}>📞 {selected.phone}</span>
                  )}
                  {selected.email && (
                    <span style={{ fontSize: '12px', color: T.t3 }}>✉️ {selected.email}</span>
                  )}
                </div>
              )}

              {fetchError && !saving && (
                <div
                  style={{
                    padding: '10px 24px',
                    background: '#2a0d0d',
                    borderBottom: '1px solid #5c1a1a',
                    fontSize: '12px',
                    color: '#f87171',
                    flexShrink: 0,
                  }}
                >
                  {fetchError}
                </div>
              )}

              {isLocked && (
                <div
                  style={{
                    padding: '12px 24px',
                    borderBottom: `1px solid ${T.border}`,
                    background: '#1a1400',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: '13px' }}>🔒</span>
                  <span style={{ fontSize: '12px', color: '#9a8040' }}>
                    Replying and exporting require{' '}
                    <a
                      href="/dashboard/billing"
                      style={{ color: '#F4C300', textDecoration: 'none', fontWeight: 600 }}
                    >
                      Pro or Enterprise
                    </a>
                    .
                  </span>
                </div>
              )}

              <div
                style={{
                  flex: 1,
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  minHeight: 0,
                }}
              >
                <div
                  style={{
                    background: T.isDark ? '#111' : '#f8f6f1',
                    border: `1px solid ${T.border}`,
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '12px',
                    color: T.t3,
                    lineHeight: 1.6,
                  }}
                >
                  Messages are retained for 90 days.
                </div>

                <div
                  style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px',
                      borderBottom: `1px solid ${T.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: T.t1 }}>
                      Message history
                    </div>
                    <div style={{ fontSize: '11px', color: T.t3 }}>
                      {threads.length > 0
                        ? `${threads.length} thread${threads.length === 1 ? '' : 's'}`
                        : 'No threads yet'}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {messagesLoading && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[...Array(3)].map((_, i) => (
                          <div key={i} style={{ ...shimmerStyle, height: '64px' }} />
                        ))}
                      </div>
                    )}

                    {!messagesLoading && messageError && (
                      <div
                        style={{
                          padding: '12px 14px',
                          background: '#2a0d0d',
                          border: '1px solid #5c1a1a',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#f87171',
                        }}
                      >
                        {messageError}
                      </div>
                    )}

                    {!messagesLoading && !messageError && messages.length === 0 && (
                      <div
                        style={{
                          padding: '18px 16px',
                          borderRadius: '8px',
                          background: T.isDark ? '#111' : '#f8f6f1',
                          border: `1px solid ${T.border}`,
                          fontSize: '12px',
                          color: T.t3,
                          lineHeight: 1.6,
                        }}
                      >
                        No message history yet. When inquiries or replies are recorded, they’ll
                        appear here.
                      </div>
                    )}

                    {!messagesLoading &&
                      !messageError &&
                      messages.map(message => {
                        const retention = getRetentionTone(message)
                        const isOutbound = message.direction === 'outbound'
                        const bodyText = message.body_purged
                          ? 'Message body expired due to retention policy.'
                          : message.body

                        return (
                          <div
                            key={message.id}
                            style={{
                              alignSelf: isOutbound ? 'flex-end' : 'flex-start',
                              width: 'min(720px, 100%)',
                            }}
                          >
                            <div
                              style={{
                                background: isOutbound
                                  ? T.isDark
                                    ? '#1f2937'
                                    : '#eef4fb'
                                  : T.card,
                                border: `1px solid ${
                                  retention.warning
                                    ? '#a16207'
                                    : retention.expired
                                      ? '#7f1d1d'
                                      : T.border
                                }`,
                                borderRadius: isOutbound
                                  ? '12px 12px 0 12px'
                                  : '0 12px 12px 12px',
                                padding: '12px 14px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '10px',
                                  marginBottom: '8px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <span
                                    style={{
                                      padding: '2px 7px',
                                      borderRadius: '20px',
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      letterSpacing: '0.04em',
                                      textTransform: 'uppercase',
                                      background: isOutbound ? '#1d4ed8' : '#0f766e',
                                      color: '#fff',
                                    }}
                                  >
                                    {isOutbound ? 'Outbound' : 'Inbound'}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.05em',
                                      color: T.t3,
                                    }}
                                  >
                                    {channelLabel(message.channel)}
                                  </span>
                                  {message.subject && (
                                    <span style={{ fontSize: '11px', color: T.t2 }}>
                                      {message.subject}
                                    </span>
                                  )}
                                </div>

                                <div style={{ fontSize: '10px', color: T.t3 }}>
                                  {fmtDateTime(message.created_at)}
                                </div>
                              </div>

                              {(message.from_email || message.to_email) && (
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: '16px',
                                    flexWrap: 'wrap',
                                    fontSize: '11px',
                                    color: T.t3,
                                    marginBottom: '8px',
                                  }}
                                >
                                  {message.from_email && <span>From: {message.from_email}</span>}
                                  {message.to_email && <span>To: {message.to_email}</span>}
                                </div>
                              )}

                              <div
                                style={{
                                  fontSize: '13px',
                                  color: message.body_purged ? T.t3 : T.t1,
                                  lineHeight: 1.65,
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                {bodyText}
                              </div>

                              <div
                                style={{
                                  marginTop: '10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '10px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <div style={{ fontSize: '10px', color: T.t3 }}>
                                  {message.thread_id
                                    ? `Thread ${message.thread_id.slice(0, 8)}`
                                    : 'No thread'}
                                </div>

                                {retention.expired ? (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      color: '#fca5a5',
                                      background: '#2a0d0d',
                                      padding: '3px 8px',
                                      borderRadius: '20px',
                                    }}
                                  >
                                    Message body expired due to retention policy.
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      color: retention.warning ? '#fbbf24' : T.t3,
                                      background: retention.warning
                                        ? '#2a1f00'
                                        : T.isDark
                                          ? '#161616'
                                          : '#f5f2ee',
                                      padding: '3px 8px',
                                      borderRadius: '20px',
                                    }}
                                  >
                                    {retention.daysRemaining} day
                                    {retention.daysRemaining === 1 ? '' : 's'} remaining
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>

                {replyFeedback && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: replyFeedback.type === 'success' ? '#86efac' : '#fca5a5',
                      background: replyFeedback.type === 'success' ? '#0d2b1e' : '#2a0d0d',
                      border:
                        replyFeedback.type === 'success'
                          ? '1px solid #14532d'
                          : '1px solid #5c1a1a',
                    }}
                  >
                    {replyFeedback.message}
                  </div>
                )}

                <div>
                  {!isLocked && (
                    <div
                      style={{
                        background: T.card,
                        border: `1px solid ${T.border}`,
                        borderRadius: '10px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '14px 16px',
                          borderBottom: `1px solid ${T.border}`,
                          display: 'grid',
                          gap: '10px',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              color: T.t3,
                              marginBottom: '6px',
                            }}
                          >
                            Subject
                          </div>
                          <input
                            value={replySubject}
                            onChange={e => setReplySubject(e.target.value)}
                            placeholder="Re: Inquiry"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              background: T.isDark ? '#111' : '#f8f6f1',
                              border: `1px solid ${T.border}`,
                              outline: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              color: T.t1,
                              fontFamily: 'sans-serif',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>

                      <textarea
                        value={replyBody}
                        onChange={e => setReplyBody(e.target.value)}
                        placeholder={
                          selected.email
                            ? `Reply to ${selected.name}…`
                            : 'This customer does not have an email address on file.'
                        }
                        rows={6}
                        disabled={!selected.email || sendingReply}
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          fontSize: '13px',
                          color: T.t1,
                          fontFamily: 'sans-serif',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                        }}
                      />

                      <div
                        style={{
                          padding: '10px 14px',
                          borderTop: `1px solid ${T.border}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ fontSize: '11px', color: T.t3 }}>
                          {selected.email
                            ? `Email will be sent to ${selected.email}`
                            : 'Add an email address to this customer to reply.'}
                        </div>
                        <button
                          onClick={handleSendReply}
                          disabled={sendingReply || !selected.email || !replyBody.trim()}
                          style={{
                            padding: '7px 16px',
                            fontSize: '12px',
                            fontWeight: 600,
                            fontFamily: 'sans-serif',
                            borderRadius: '6px',
                            border: 'none',
                            background: T.isDark ? '#F4C300' : '#1a1917',
                            color: T.isDark ? '#000' : '#fff',
                            cursor:
                              sendingReply || !selected.email || !replyBody.trim()
                                ? 'not-allowed'
                                : 'pointer',
                            opacity:
                              sendingReply || !selected.email || !replyBody.trim() ? 0.5 : 1,
                          }}
                        >
                          {sendingReply ? 'Sending…' : 'Send Email'}
                        </button>
                      </div>
                    </div>
                  )}

                  {isLocked && (
                    <div
                      style={{
                        background: T.card,
                        border: `1px solid ${T.border}`,
                        borderRadius: '10px',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ opacity: 0.3, pointerEvents: 'none' }}>
                        <div
                          style={{
                            padding: '14px 16px',
                            borderBottom: `1px solid ${T.border}`,
                          }}
                        >
                          <div
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              color: T.t3,
                              marginBottom: '6px',
                            }}
                          >
                            Subject
                          </div>
                          <input
                            value="Re: Inquiry"
                            readOnly
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              background: T.isDark ? '#111' : '#f8f6f1',
                              border: `1px solid ${T.border}`,
                              outline: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              color: T.t1,
                              fontFamily: 'sans-serif',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <textarea
                          placeholder={`Reply to ${selected.name}…`}
                          rows={6}
                          disabled
                          style={{
                            width: '100%',
                            padding: '14px 16px',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            fontSize: '13px',
                            color: T.t1,
                            fontFamily: 'sans-serif',
                            resize: 'none',
                            boxSizing: 'border-box',
                          }}
                        />

                        <div
                          style={{
                            padding: '10px 14px',
                            borderTop: `1px solid ${T.border}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                        >
                          <div style={{ fontSize: '11px', color: T.t3 }}>
                            Upgrade to unlock email replies.
                          </div>
                          <span
                            style={{
                              padding: '7px 16px',
                              fontSize: '12px',
                              fontWeight: 600,
                              borderRadius: '6px',
                              background: T.isDark ? '#F4C300' : '#1a1917',
                              color: T.isDark ? '#000' : '#fff',
                            }}
                          >
                            Send Email
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          borderTop: `1px solid ${T.border}`,
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: T.isDark ? '#111' : '#f8f6f1',
                        }}
                      >
                        <a
                          href="/dashboard/billing"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 20px',
                            borderRadius: '6px',
                            background: '#F4C300',
                            color: '#000',
                            fontSize: '13px',
                            fontWeight: 700,
                            textDecoration: 'none',
                            letterSpacing: '0.02em',
                          }}
                        >
                          🔒 Upgrade to reply
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 40px',
                  textAlign: 'center',
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.5 }}>📬</div>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: T.t1,
                    marginBottom: '6px',
                  }}
                >
                  Select a conversation to view details
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: T.t3,
                    maxWidth: '300px',
                    lineHeight: 1.6,
                  }}
                >
                  {isLocked
                    ? 'You can preview your contacts here. Upgrade to Pro to reply, resolve, export, and manage conversations.'
                    : 'Your customer messages, booking requests, and follow-ups all live here.'}
                </div>
              </div>

              <div
                style={{
                  padding: '24px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: '10px',
                    padding: '18px 20px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: T.t3,
                      marginBottom: '12px',
                    }}
                  >
                    Recent Activity
                  </div>

                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[...Array(3)].map((_, i) => (
                        <div key={i} style={{ ...shimmerStyle, height: '12px' }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {conversations.slice(0, 3).map(c => (
                        <div
                          key={c.id}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background:
                                c.status === 'new'
                                  ? '#34d399'
                                  : c.status === 'waiting_you'
                                    ? '#F4C300'
                                    : '#818cf8',
                              flexShrink: 0,
                              marginTop: '5px',
                            }}
                          />
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

                <div
                  style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: '10px',
                    padding: '18px 20px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: T.t3,
                      marginBottom: '12px',
                    }}
                  >
                    Follow-up Queue
                  </div>

                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[...Array(3)].map((_, i) => (
                        <div key={i} style={{ ...shimmerStyle, height: '12px' }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {conversations
                        .filter(c => c.status === 'waiting_you')
                        .slice(0, 3)
                        .map(c => (
                          <div
                            key={c.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '10px',
                            }}
                          >
                            <div style={{ fontSize: '12px', color: T.t1 }}>{c.name}</div>
                            <div style={{ fontSize: '10px', color: '#F4C300' }}>Needs reply</div>
                          </div>
                        ))}
                      {conversations.filter(c => c.status === 'waiting_you').length === 0 && (
                        <div style={{ fontSize: '12px', color: T.t3 }}>Nothing waiting on you</div>
                      )}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: '10px',
                    padding: '18px 20px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: T.t3,
                      marginBottom: '12px',
                    }}
                  >
                    Overview
                  </div>

                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[...Array(3)].map((_, i) => (
                        <div key={i} style={{ ...shimmerStyle, height: '12px' }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: T.t3 }}>Total conversations</span>
                        <span style={{ fontSize: '12px', color: T.t1, fontWeight: 600 }}>
                          {conversations.length}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: T.t3 }}>Unread</span>
                        <span style={{ fontSize: '12px', color: T.t1, fontWeight: 600 }}>
                          {unreadCount}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: T.t3 }}>Waiting on you</span>
                        <span style={{ fontSize: '12px', color: T.t1, fontWeight: 600 }}>
                          {waitingYouCount}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
