'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    async function load() {
      // Check auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/dashboard/login'); return }

      // Load tenant info
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name')
        .single()

      // Load KPIs
      const { count: totalBookings } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })

      const { count: upcomingBookings } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .in('status', ['confirmed', 'pending'])
        .gte('starts_at', new Date().toISOString())

      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })

      const { data: bookings } = await supabase
        .from('bookings')
        .select('price_cents, status')

      const revenue = (bookings ?? [])
        .filter(b => b.status === 'completed')
        .reduce((sum: number, b: any) => sum + (b.price_cents ?? 0), 0)

      setData({ tenant, totalBookings, upcomingBookings, totalCustomers, revenue })
      setLoading(false)
    }
    load()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/dashboard/login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f6f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#9a9590' }}>
      Loading...
    </div>
  )

  const kpis = [
    { label: 'Total bookings',    value: data.totalBookings ?? 0 },
    { label: 'Upcoming',          value: data.upcomingBookings ?? 0 },
    { label: 'Total customers',   value: data.totalCustomers ?? 0 },
    { label: 'Revenue',           value: `$${((data.revenue ?? 0) / 100).toFixed(0)}` },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f8f6f1', fontFamily: 'sans-serif' }}>
      {/* Top bar */}
      <div style={{ background: '#1a1917', padding: '0 28px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#f0ede6', fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
          {data.tenant?.name ?? 'Dashboard'}
        </span>
        <button onClick={signOut} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#9a9590', padding: '5px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
          Sign out
        </button>
      </div>

      <div style={{ padding: '28px', maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', color: '#1a1917', marginBottom: '20px', fontStyle: 'italic' }}>
          Overview
        </h1>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: '#fff', border: '1px solid #e8e4dc', borderRadius: '8px', padding: '18px 20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9a9590', marginBottom: '8px' }}>
                {k.label}
              </div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '28px', color: '#1a1917' }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: 'Bookings',     href: '/dashboard/bookings' },
            { label: 'Customers',    href: '/dashboard/customers' },
            { label: 'Inbox',        href: '/dashboard/inbox' },
            { label: 'Campaigns',    href: '/dashboard/campaigns' },
            { label: 'Availability', href: '/dashboard/availability' },
            { label: 'Settings',     href: '/dashboard/settings' },
          ].map(item => (
            <a key={item.href} href={item.href} style={{
              padding: '9px 18px', background: '#fff', border: '1px solid #e8e4dc',
              borderRadius: '6px', fontSize: '13px', fontWeight: 500,
              color: '#1a1917', textDecoration: 'none'
            }}>
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
