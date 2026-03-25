'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [bookings, setBookings] = useState<any[]>([])

  useEffect(() => {
    checkAuth()
    loadCustomers()
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) router.push('/dashboard/login')
  }

  async function loadCustomers() {
    setLoading(true)
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setCustomers(data ?? [])
    setLoading(false)
  }

  async function selectCustomer(c: any) {
    setSelected(c)
    const { data } = await supabase
      .from('bookings')
      .select('id, status, starts_at, price_cents, services(name)')
      .eq('customer_id', c.id)
      .order('starts_at', { ascending: false })
    setBookings(data ?? [])
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    return (
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    )
  })

  const totalSpend = bookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + (b.price_cents ?? 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#f8f6f1', fontFamily: 'sans-serif' }}>
      {/* Top bar */}
      <div style={{ background: '#1a1917', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <a href="/dashboard" style={{ color: '#888', fontSize: '13px', textDecoration: 'none' }}>← Overview</a>
          <span style={{ color: '#f0ede6', fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Customers</span>
        </div>
        <span style={{ color: '#888', fontSize: '13px' }}>{customers.length} total</span>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 52px)' }}>

        {/* Left: customer list */}
        <div style={{ width: '340px', flexShrink: 0, borderRight: '1px solid #e8e4dc', display: 'flex', flexDirection: 'column', background: '#fff' }}>
          {/* Search */}
          <div style={{ padding: '12px', borderBottom: '1px solid #e8e4dc' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, phone..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e8e4dc', borderRadius: '6px', fontSize: '13px', fontFamily: 'sans-serif', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9a9590' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9a9590' }}>No customers found</div>
            ) : filtered.map(c => (
              <div key={c.id} onClick={() => selectCustomer(c)}
                style={{ padding: '14px 16px', borderBottom: '1px solid #f0ede6', cursor: 'pointer',
                  background: selected?.id === c.id ? '#eef4fb' : 'transparent' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#1a1917', marginBottom: '3px' }}>
                  {c.first_name} {c.last_name}
                </div>
                <div style={{ fontSize: '12px', color: '#9a9590', marginBottom: '2px' }}>{c.phone}</div>
                <div style={{ fontSize: '11px', color: '#c8c4bc' }}>{c.email}</div>
                {c.lead_source && (
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: '#f0ede6', color: '#9a9590', fontFamily: 'monospace' }}>
                      {c.lead_source}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: customer detail */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9a9590', fontSize: '14px', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
              Select a customer to view details
            </div>
          ) : (
            <div style={{ maxWidth: '600px' }}>
              {/* Header */}
              <div style={{ background: '#fff', border: '1px solid #e8e4dc', borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', color: '#1a1917', marginBottom: '12px', fontStyle: 'italic' }}>
                  {selected.first_name} {selected.last_name}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { label: 'Phone',   value: selected.phone },
                    { label: 'Email',   value: selected.email },
                    { label: 'Source',  value: selected.lead_source },
                    { label: 'Joined',  value: fmtDate(selected.created_at) },
                  ].map(row => row.value && (
                    <div key={row.label}>
                      <div style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9a9590', marginBottom: '2px' }}>{row.label}</div>
                      <div style={{ fontSize: '13px', color: '#1a1917' }}>{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                {[
                  { label: 'Total bookings', value: bookings.length },
                  { label: 'Completed',      value: bookings.filter(b => b.status === 'completed').length },
                  { label: 'Total spend',    value: '$' + (totalSpend / 100).toFixed(0) },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e4dc', borderRadius: '8px', padding: '14px 16px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9a9590', marginBottom: '6px' }}>{s.label}</div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '24px', color: '#1a1917' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Booking history */}
              <div style={{ background: '#fff', border: '1px solid #e8e4dc', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e4dc', fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'italic', color: '#1a1917' }}>
                  Booking history
                </div>
                {bookings.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#9a9590', fontSize: '13px' }}>No bookings yet</div>
                ) : bookings.map(b => {
                  const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.pending
                  return (
                    <div key={b.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f0ede6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1917' }}>{b.services?.name}</div>
                        <div style={{ fontSize: '11px', color: '#9a9590', fontFamily: 'monospace', marginTop: '2px' }}>{fmtDate(b.starts_at)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '13px', color: '#4a4843' }}>{fmtPrice(b.price_cents)}</span>
                        <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 500, background: sc.bg, color: sc.color }}>{b.status}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
