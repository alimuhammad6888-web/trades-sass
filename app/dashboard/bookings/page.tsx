'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function BookingsPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
    loadBookings()
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) router.push('/dashboard/login')
  }

  async function loadBookings() {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select(`
        id, status, starts_at, ends_at, price_cents, notes, created_at,
        customers ( first_name, last_name, phone, email ),
        services  ( name, duration_mins )
      `)
      .order('starts_at', { ascending: false })
    setBookings(data ?? [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    await supabase.from('bookings').update({ status }).eq('id', id)
    await loadBookings()
    setUpdating(null)
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  function fmtPrice(cents: number | null) {
    if (!cents) return 'Quote'
    return '$' + (cents / 100).toFixed(0)
  }

  const STATUS_COLORS: any = {
    pending:   { bg: '#fef4e0', color: '#9a5c10' },
    confirmed: { bg: '#e8f5ee', color: '#1a6b4a' },
    completed: { bg: '#eef4fb', color: '#1e4d8c' },
    cancelled: { bg: '#fdf0ef', color: '#8c2820' },
    no_show:   { bg: '#f5f5f5', color: '#666' },
  }

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter)

  const nav: any = { minHeight: '100vh', background: '#f8f6f1', fontFamily: 'sans-serif' }

  return (
    <div style={nav}>
      {/* Top bar */}
      <div style={{ background: '#1a1917', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <a href="/dashboard" style={{ color: '#888', fontSize: '13px', textDecoration: 'none' }}>← Overview</a>
          <span style={{ color: '#f0ede6', fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Bookings</span>
        </div>
        <a href="/dashboard/customers" style={{ color: '#888', fontSize: '13px', textDecoration: 'none' }}>Customers →</a>
      </div>

      <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {['all','pending','confirmed','completed','cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'sans-serif',
                background: filter === f ? '#1a1917' : '#fff',
                color:      filter === f ? '#fff'    : '#4a4843',
                borderColor:filter === f ? '#1a1917' : '#e8e4dc',
              }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && (
                <span style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.7 }}>
                  {bookings.filter(b => b.status === f).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bookings list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9a9590' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9a9590', background: '#fff', border: '1px solid #e8e4dc', borderRadius: '8px' }}>
            No {filter === 'all' ? '' : filter} bookings yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(b => {
              const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.pending
              const customer = b.customers
              const service  = b.services
              return (
                <div key={b.id} style={{ background: '#fff', border: '1px solid #e8e4dc', borderRadius: '8px', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>

                    {/* Left: customer + service info */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 600, color: '#1a1917' }}>
                          {customer?.first_name} {customer?.last_name}
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: sc.bg, color: sc.color }}>
                          {b.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#4a4843', marginBottom: '2px' }}>
                        {service?.name} · {fmtPrice(b.price_cents)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9a9590', fontFamily: 'monospace' }}>
                        {fmt(b.starts_at)} at {fmtTime(b.starts_at)}
                      </div>
                      {customer?.phone && (
                        <div style={{ fontSize: '12px', color: '#9a9590', marginTop: '4px' }}>
                          📞 {customer.phone}
                          {customer?.email && ` · ${customer.email}`}
                        </div>
                      )}
                      {b.notes && (
                        <div style={{ fontSize: '12px', color: '#9a9590', marginTop: '6px', fontStyle: 'italic' }}>
                          Note: {b.notes}
                        </div>
                      )}
                    </div>

                    {/* Right: action buttons */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      {b.status === 'pending' && (
                        <button onClick={() => updateStatus(b.id, 'confirmed')}
                          disabled={updating === b.id}
                          style={{ padding: '6px 14px', background: '#1a6b4a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', opacity: updating === b.id ? 0.5 : 1 }}>
                          Confirm
                        </button>
                      )}
                      {b.status === 'confirmed' && (
                        <button onClick={() => updateStatus(b.id, 'completed')}
                          disabled={updating === b.id}
                          style={{ padding: '6px 14px', background: '#1e4d8c', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', opacity: updating === b.id ? 0.5 : 1 }}>
                          Mark complete
                        </button>
                      )}
                      {!['cancelled','completed','no_show'].includes(b.status) && (
                        <button onClick={() => updateStatus(b.id, 'cancelled')}
                          disabled={updating === b.id}
                          style={{ padding: '6px 14px', background: 'transparent', color: '#8c2820', border: '1px solid #8c2820', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', opacity: updating === b.id ? 0.5 : 1 }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
