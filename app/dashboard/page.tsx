'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { resolveTenant, type Tenant } from '@/lib/tenant'
import UpgradeModal from './UpgradeModal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {
  const router  = useRouter()
  const [loading, setLoading]     = useState(true)
  const [tenant, setTenant]       = useState<Tenant | null>(null)
  const [data, setData]           = useState<any>(null)
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/dashboard/login'); return }

      const t = await resolveTenant()
      setTenant(t)

      const { count: totalBookings }   = await supabase.from('bookings').select('id', { count:'exact', head:true }).eq('tenant_id', t?.id ?? '')
      const { count: upcomingBookings } = await supabase.from('bookings').select('id', { count:'exact', head:true }).eq('tenant_id', t?.id ?? '').in('status', ['confirmed','pending']).gte('starts_at', new Date().toISOString())
      const { count: totalCustomers }  = await supabase.from('customers').select('id', { count:'exact', head:true }).eq('tenant_id', t?.id ?? '')
      const { data: bookings }         = await supabase.from('bookings').select('price_cents, status').eq('tenant_id', t?.id ?? '')
      const revenue = (bookings ?? []).filter(b => b.status === 'completed').reduce((sum: number, b: any) => sum + (b.price_cents ?? 0), 0)

      setData({ totalBookings, upcomingBookings, totalCustomers, revenue })
      setLoading(false)
    }
    load()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/dashboard/login')
  }

  function navItem(label: string, href: string, feature?: string) {
    const locked = feature && tenant && !tenant.features[feature as keyof typeof tenant.features]
    return (
      
        key={label}
        href={locked ? undefined : href}
        onClick={locked ? () => setUpgradeFeature(feature!) : undefined}
        style={{
          padding: '9px 18px',
          background: '#fff',
          border: '1px solid #e8e4dc',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 500,
          color: locked ? '#9a9590' : '#1a1917',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
        }}>
        {label}
        {locked && (
          <span style={{ fontSize:'10px', padding:'2px 6px', background:'#fef4e0', color:'#9a5c10', borderRadius:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>
            Pro
          </span>
        )}
      </a>
    )
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#f8f6f1', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif', color:'#9a9590' }}>
      Loading...
    </div>
  )

  const kpis = [
    { label:'Bookings',   value: data.totalBookings ?? 0 },
    { label:'Upcoming',   value: data.upcomingBookings ?? 0 },
    { label:'Customers',  value: data.totalCustomers ?? 0 },
    { label:'Revenue',    value: '$' + ((data.revenue ?? 0) / 100).toFixed(0) },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#f8f6f1', fontFamily:'sans-serif' }}>

      {/* Top bar */}
      <div style={{ background:'#1a1917', padding:'0 28px', height:'52px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <span style={{ color:'#f0ede6', fontSize:'16px', fontFamily:'Georgia, serif', fontStyle:'italic' }}>
            {tenant?.name ?? 'Dashboard'}
          </span>
          {tenant?.plan && (
            <span style={{ fontSize:'10px', padding:'2px 8px', background: tenant.plan === 'pro' ? '#1a3a2a' : tenant.plan === 'enterprise' ? '#1a2a3a' : '#2a2a2a', color: tenant.plan === 'pro' ? '#34A668' : tenant.plan === 'enterprise' ? '#3B82C4' : '#666', borderRadius:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>
              {tenant.plan}
            </span>
          )}
        </div>
        <button onClick={signOut} style={{ background:'none', border:'1px solid rgba(255,255,255,0.15)', color:'#9a9590', padding:'5px 14px', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontFamily:'sans-serif' }}>
          Sign out
        </button>
      </div>

      <div style={{ padding:'28px', maxWidth:'900px', margin:'0 auto' }}>
        <h1 style={{ fontFamily:'Georgia, serif', fontSize:'22px', color:'#1a1917', marginBottom:'20px', fontStyle:'italic' }}>Overview</h1>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', padding:'18px 20px' }}>
              <div style={{ fontSize:'11px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9a9590', marginBottom:'8px' }}>{k.label}</div>
              <div style={{ fontFamily:'Georgia, serif', fontSize:'28px', color:'#1a1917' }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Nav */}
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
          {navItem('Bookings',     '/dashboard/bookings')}
          {navItem('Customers',    '/dashboard/customers')}
          {navItem('Inbox',        '/dashboard/inbox',        'inbox')}
          {navItem('Campaigns',    '/dashboard/campaigns',    'campaigns')}
          {navItem('Availability', '/dashboard/availability')}
          {navItem('Settings',     '/dashboard/settings')}
        </div>

        {/* Chatbot teaser */}
        {tenant && !tenant.features.chatbot && (
          <div style={{ marginTop:'20px', background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', padding:'20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'16px', flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:'13px', fontWeight:600, color:'#1a1917', marginBottom:'4px' }}>
                💬 AI Chatbot — capture leads while you sleep
              </div>
              <div style={{ fontSize:'13px', color:'#9a9590' }}>
                Automatically answer customer questions and book appointments 24/7.
              </div>
            </div>
            <button onClick={() => setUpgradeFeature('chatbot')}
              style={{ padding:'8px 18px', background:'#1a1917', color:'#fff', border:'none', borderRadius:'6px', fontSize:'13px', fontWeight:500, cursor:'pointer', fontFamily:'sans-serif', whiteSpace:'nowrap' }}>
              Unlock — Pro
            </button>
          </div>
        )}
      </div>

      {upgradeFeature && (
        <UpgradeModal
          feature={upgradeFeature}
          plan={tenant?.plan ?? 'free'}
          onClose={() => setUpgradeFeature(null)}
        />
      )}
    </div>
  )
}
