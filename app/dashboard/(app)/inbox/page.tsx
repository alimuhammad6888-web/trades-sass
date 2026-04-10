'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useTenant } from '@/lib/tenant-context'
import { useThemeTokens } from '@/lib/theme'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  new:      { bg: '#fef4e0', color: '#9a5c10' },
  open:     { bg: '#eef4fb', color: '#1e4d8c' },
  resolved: { bg: '#e8f5ee', color: '#1a6b4a' },
}

type Thread = {
  id: string
  source: string
  subject: string | null
  status: string
  created_at: string
  last_message_at: string
  customers: { first_name: string; last_name: string; phone: string; email: string } | null
}

type Message = {
  id: string
  direction: string
  channel: string
  body: string
  created_at: string
}

export default function InboxPage() {
  const { tenant } = useTenant()
  const T = useThemeTokens()

  const [threads, setThreads]     = useState<Thread[]>([])
  const [fetched, setFetched]     = useState(false)
  const [selected, setSelected]   = useState<Thread | null>(null)
  const [messages, setMessages]   = useState<Message[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [filter, setFilter]       = useState('all')

  useEffect(() => {
    if (!tenant?.id) return
    loadThreads()
  }, [tenant?.id])

  async function loadThreads() {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('inbox_threads')
      .select(`
        id, source, subject, status, created_at, last_message_at,
        customers ( first_name, last_name, phone, email )
      `)
      .eq('tenant_id', tenant!.id)
      .gt('expires_at', now)
      .is('archived_at', null)
      .order('last_message_at', { ascending: false })
    setThreads(data ?? [])
    setFetched(true)
  }

  async function selectThread(t: Thread) {
    setSelected(t)
    setLoadingMsgs(true)
    const { data } = await supabase
      .from('inbox_messages')
      .select('id, direction, channel, body, created_at')
      .eq('thread_id', t.id)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoadingMsgs(false)

    // Mark as open if new
    if (t.status === 'new') {
      await supabase
        .from('inbox_threads')
        .update({ status: 'open' })
        .eq('id', t.id)
      setThreads(prev => prev.map(th => th.id === t.id ? { ...th, status: 'open' } : th))
      setSelected(s => s?.id === t.id ? { ...s, status: 'open' } : s)
    }
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('inbox_threads').update({ status }).eq('id', id)
    setThreads(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    setSelected(s => s?.id === id ? { ...s, status } : s)
  }

  async function archiveThread(id: string) {
    await supabase.from('inbox_threads').update({ archived_at: new Date().toISOString() }).eq('id', id)
    setThreads(prev => prev.filter(t => t.id !== id))
    if (selected?.id === id) {
      setSelected(null)
      setMessages([])
    }
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const newCount = threads.filter(t => t.status === 'new').length
  const filtered = filter === 'all' ? threads : threads.filter(t => t.status === filter)

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: 'sans-serif', transition: 'background 0.2s' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .inbox-grid { display: grid; grid-template-columns: 340px 1fr; height: calc(100vh - 120px); }
        @media (max-width: 768px) {
          .inbox-grid { grid-template-columns: 1fr !important; }
          .inbox-detail { display: none !important; }
          .inbox-detail.show { display: block !important; position: fixed !important; inset: 0 !important; z-index: 20 !important; overflow-y: auto !important; padding-top: 52px !important; background: ${T.bg} !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ padding: '20px 20px 0' }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '22px', fontStyle: 'italic', color: T.t1, marginBottom: '4px' }}>Inbox</h1>
        <p style={{ fontSize: '13px', color: T.t3, marginBottom: '16px' }}>Customer inquiries from your contact form</p>

        {/* New thread alert */}
        {fetched && newCount > 0 && (
          <div style={{ background: T.isDark ? '#2a1a00' : '#fef4e0', border: `1px solid ${T.isDark ? '#5a3a00' : '#f0c060'}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', animation: 'slideDown 0.3s ease' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E07B2A', animation: 'pulse 1.5s ease infinite', flexShrink: 0 }} />
            <div style={{ fontSize: '14px', fontWeight: 600, color: T.isDark ? '#F4C300' : '#9a5c10' }}>
              {newCount} new inquir{newCount > 1 ? 'ies' : 'y'}
            </div>
            <button onClick={() => setFilter('new')}
              style={{ marginLeft: 'auto', padding: '5px 12px', background: '#E07B2A', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'sans-serif' }}>
              View new
            </button>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {['all', 'new', 'open', 'resolved'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${filter === f ? T.t1 : T.border}`, fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'sans-serif', background: filter === f ? T.t1 : T.card, color: filter === f ? (T.isDark ? '#000' : '#fff') : T.t2, transition: 'all 0.15s' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && <span style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.6 }}>{threads.filter(t => t.status === f).length}</span>}
            </button>
          ))}
        </div>
      </div>

      {!fetched ? (
        <div style={{ padding: '20px' }}>
          {[1, 2, 3].map(i => <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', height: '72px', marginBottom: '8px', animation: 'pulse 1.5s ease infinite' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📬</div>
          <div style={{ fontSize: '15px', color: T.t1, fontWeight: 600, marginBottom: '6px' }}>No {filter === 'all' ? '' : filter + ' '}inquiries</div>
          <div style={{ fontSize: '13px', color: T.t3 }}>
            When customers submit your contact form, their messages will show up here.
          </div>
        </div>
      ) : (
        <div className="inbox-grid" style={{ padding: '0 20px 20px' }}>
          {/* Thread list */}
          <div style={{ borderRight: `1px solid ${T.border}`, overflowY: 'auto', paddingRight: '12px' }}>
            {filtered.map(t => {
              const c = t.customers
              const sc = STATUS_STYLES[t.status] ?? STATUS_STYLES.new
              const isActive = selected?.id === t.id
              return (
                <div key={t.id} onClick={() => selectThread(t)}
                  style={{ padding: '14px 16px', background: isActive ? T.hover : 'transparent', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', borderLeft: t.status === 'new' ? '3px solid #E07B2A' : '3px solid transparent', transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.hover }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: t.status === 'new' ? 700 : 500, color: T.t1 }}>
                      {c?.first_name} {c?.last_name}
                    </span>
                    <span style={{ fontSize: '11px', color: T.t3 }}>{fmtDate(t.last_message_at)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '10px', background: sc.bg, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {t.status}
                    </span>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px', background: T.isDark ? '#1a1a2a' : '#eef4fb', color: T.isDark ? '#7a8aaa' : '#1e4d8c' }}>
                      Contact form
                    </span>
                  </div>
                  {t.subject && <div style={{ fontSize: '12px', color: T.t3, marginTop: '4px', fontStyle: 'italic' }}>{t.subject}</div>}
                </div>
              )
            })}
          </div>

          {/* Detail panel */}
          <div className={`inbox-detail${selected ? ' show' : ''}`} style={{ overflowY: 'auto', paddingLeft: '20px' }}>
            {!selected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.t3, fontStyle: 'italic', fontFamily: 'Georgia,serif' }}>
                Select an inquiry to view
              </div>
            ) : (
              <div>
                {/* Mobile back */}
                <button onClick={() => setSelected(null)}
                  style={{ display: 'none', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: T.t3, fontSize: '13px', cursor: 'pointer', padding: '16px 0 8px', fontFamily: 'sans-serif' }}>
                  ← All inquiries
                </button>

                {/* Customer info card */}
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h3 style={{ fontFamily: 'Georgia,serif', fontSize: '16px', fontStyle: 'italic', color: T.t1 }}>
                      {selected.customers?.first_name} {selected.customers?.last_name}
                    </h3>
                    <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px', background: (STATUS_STYLES[selected.status] ?? STATUS_STYLES.new).bg, color: (STATUS_STYLES[selected.status] ?? STATUS_STYLES.new).color, textTransform: 'uppercase' }}>
                      {selected.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: T.t2 }}>
                    {selected.customers?.phone && <div>📞 {selected.customers.phone}</div>}
                    {selected.customers?.email && <div>📧 {selected.customers.email}</div>}
                    <div style={{ fontSize: '11px', color: T.t3, marginTop: '4px' }}>
                      Received {fmtDate(selected.created_at)} at {fmtTime(selected.created_at)} · via contact form
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {selected.status !== 'resolved' && (
                    <button onClick={() => updateStatus(selected.id, 'resolved')}
                      style={{ padding: '7px 14px', background: '#1a6b4a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'sans-serif' }}>
                      ✓ Mark resolved
                    </button>
                  )}
                  {selected.status === 'resolved' && (
                    <button onClick={() => updateStatus(selected.id, 'open')}
                      style={{ padding: '7px 14px', background: 'transparent', color: '#1e4d8c', border: '1px solid #1e4d8c', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'sans-serif' }}>
                      Reopen
                    </button>
                  )}
                  <button onClick={() => archiveThread(selected.id)}
                    style={{ padding: '7px 14px', background: 'transparent', color: T.t3, border: `1px solid ${T.border}`, borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'sans-serif' }}>
                    Archive
                  </button>
                </div>

                {/* Messages */}
                <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.label, marginBottom: '10px' }}>Messages</div>
                {loadingMsgs ? (
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', height: '60px', animation: 'pulse 1.5s ease infinite' }} />
                ) : messages.length === 0 ? (
                  <div style={{ color: T.t3, fontSize: '13px', fontStyle: 'italic' }}>No messages</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {messages.map(m => (
                      <div key={m.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: T.isDark ? '#7a8aaa' : '#1e4d8c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {m.direction === 'inbound' ? '← Customer' : '→ You'}
                          </span>
                          <span style={{ fontSize: '11px', color: T.t3 }}>
                            {fmtDate(m.created_at)} {fmtTime(m.created_at)}
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', color: T.t1, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {m.body}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
