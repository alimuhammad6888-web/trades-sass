'use client'

import { useEffect, useState } from 'react'

type ReplyMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  created_at: string
}

type ReplyData = {
  tenantName: string
  customerPhone: string
  replyFromPhone: string
  threadId: string | null
  messages: ReplyMessage[]
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function QuickReplyPage({
  params,
}: {
  params: { token: string }
}) {
  const token = params.token

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [data, setData] = useState<ReplyData | null>(null)
  const [body, setBody] = useState('')

  useEffect(() => {
    let mounted = true

    async function load() {
      const res = await fetch(`/api/reply/${token}`)
      const payload = await res.json().catch(() => null)

      if (!mounted) return

      if (!res.ok) {
        setError(payload?.error ?? 'Failed to load reply page.')
        setLoading(false)
        return
      }

      setData(payload)
      setLoading(false)
    }

    load()

    return () => {
      mounted = false
    }
  }, [token])

  async function sendReply() {
    if (!token || !body.trim() || sending) return

    setSending(true)
    setError(null)
    setSuccess(null)

    const res = await fetch(`/api/reply/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: body.trim() }),
    })

    const payload = await res.json().catch(() => null)

    if (!res.ok) {
      setError(payload?.error ?? 'Failed to send reply.')
      setSending(false)
      return
    }

    setSuccess('Reply sent successfully.')
    setBody('')

    if (payload?.message && data) {
      setData({
        ...data,
        messages: [...data.messages, payload.message],
      })
    }

    setSending(false)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f4f2ee',
        fontFamily: 'sans-serif',
        padding: '20px 16px 40px',
      }}
    >
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div
          style={{
            background: '#fff',
            border: '1px solid #e8e4dc',
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '18px 20px',
              background: '#1a1917',
              borderBottom: '3px solid #F4C300',
            }}
          >
            <div
              style={{
                color: '#F4C300',
                fontSize: '20px',
                fontWeight: 700,
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
              }}
            >
              Quick Reply
            </div>
          </div>

          <div style={{ padding: '20px' }}>
            {loading && (
              <div style={{ fontSize: '14px', color: '#6b665f' }}>Loading…</div>
            )}

            {!loading && error && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: '#fdf0ef',
                  border: '1px solid #f2c8c5',
                  color: '#8c2820',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}

            {!loading && data && (
              <>
                <div style={{ marginBottom: '18px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#9a9590',
                      marginBottom: '6px',
                    }}
                  >
                    Business
                  </div>
                  <div style={{ fontSize: '14px', color: '#1a1917', fontWeight: 600 }}>
                    {data.tenantName}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '18px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: '#9a9590',
                        marginBottom: '6px',
                      }}
                    >
                      Customer
                    </div>
                    <div style={{ fontSize: '13px', color: '#1a1917' }}>
                      {data.customerPhone}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: '#9a9590',
                        marginBottom: '6px',
                      }}
                    >
                      Sending From
                    </div>
                    <div style={{ fontSize: '13px', color: '#1a1917' }}>
                      {data.replyFromPhone}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    border: '1px solid #e8e4dc',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid #e8e4dc',
                      background: '#f8f6f1',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#1a1917',
                    }}
                  >
                    Latest Messages
                  </div>

                  <div
                    style={{
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {data.messages.length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#9a9590' }}>
                        No messages yet.
                      </div>
                    ) : (
                      data.messages.map(message => (
                        <div
                          key={message.id}
                          style={{
                            alignSelf:
                              message.direction === 'outbound' ? 'flex-end' : 'flex-start',
                            maxWidth: '90%',
                            background:
                              message.direction === 'outbound' ? '#eef4fb' : '#fff',
                            border: '1px solid #e8e4dc',
                            borderRadius:
                              message.direction === 'outbound'
                                ? '12px 12px 0 12px'
                                : '0 12px 12px 12px',
                            padding: '10px 12px',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '13px',
                              color: '#1a1917',
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.6,
                            }}
                          >
                            {message.body}
                          </div>
                          <div
                            style={{
                              fontSize: '10px',
                              color: '#9a9590',
                              marginTop: '6px',
                            }}
                          >
                            {fmtDateTime(message.created_at)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {success && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: '#e8f5ee',
                      border: '1px solid #b9dfc8',
                      color: '#1a6b4a',
                      fontSize: '13px',
                      marginBottom: '14px',
                    }}
                  >
                    {success}
                  </div>
                )}

                <div
                  style={{
                    border: '1px solid #e8e4dc',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid #e8e4dc',
                      background: '#f8f6f1',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#1a1917',
                    }}
                  >
                    Send Reply
                  </div>

                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={5}
                    placeholder={`Reply to ${data.customerPhone}…`}
                    style={{
                      width: '100%',
                      padding: '14px',
                      border: 'none',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      fontSize: '14px',
                      color: '#1a1917',
                      fontFamily: 'sans-serif',
                    }}
                  />

                  <div
                    style={{
                      padding: '10px 14px',
                      borderTop: '1px solid #e8e4dc',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#9a9590' }}>
                      This link stays active until it expires.
                    </div>

                    <button
                      onClick={sendReply}
                      disabled={sending || !body.trim()}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#1a1917',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: sending || !body.trim() ? 'not-allowed' : 'pointer',
                        opacity: sending || !body.trim() ? 0.5 : 1,
                      }}
                    >
                      {sending ? 'Sending…' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
