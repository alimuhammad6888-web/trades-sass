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
  const router = useRouter()
  const [loading, setLoading]               = useState(true)
  const [tenant, setTenant]                 = useState<Tenant | null>(null)
  const [data, setData]                     = useState<any>(null)
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null)
  const [recentBookings, setRecentBookings] = useState<any[]>([])
  const [dark, setDark]                     = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('dash-theme')
    if (saved === 'light') setDark(false)
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    localStorage.setItem('dash-theme', next ? 'dark' : 'light')
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/dashboard/login'); return }

      const t = await resolveTenant()
      setTenant(t)
      const tid = t?.id ?? ''

      const [b1, b2, c1, b3, recent] = await Promise.all([
        supabase.from('bookings').select('id', { count:'exact', head:true }).eq('tenant_id', tid),
        supabase.from('bookings').select('id', { count:'exact', head:true }).eq('tenant_id', tid).in('status', ['confirmed','pending']).gte('starts_at', new Date().toISOString()),
        supabase.from('customers').select('id', { count:'exact', head:true }).eq('tenant_id', tid),
        supabase.from('bookings').select('price_cents, status').eq('tenant_id', tid),
        supabase.from('bookings').select('id, status, starts_at, customers(first_name, last_name), services(name)').eq('tenant_id', tid).order('starts_at', { ascending:false }).limit(5),
      ])

      const revenue = (b3.data ?? [])
        .filter((b: any) => b.status === 'completed')
        .reduce((sum: number, b: any) => sum + (b.price_cents ?? 0), 0)

      setData({ totalBookings: b1.count ?? 0, upcomingBookings: b2.count ?? 0, totalCustomers: c1.count ?? 0, revenue })
      setRecentBookings(recent.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/dashboard/login')
  }

  // Theme tokens
  const T = dark ? {
    bg:         '#0f0f0f',
    topbar:     '#111',
    topborder:  '#1a1a1a',
    card:       '#161616',
    cardborder: '#2e2e2e',
    cardhover:  '#1a1a1a',
    divider:    '#1e1e1e',
    text1:      '#ffffff',
    text2:      '#cccccc',
    text3:      '#aaaaaa',
    text4:      '#777777',
    label:      '#999999',
    kpiVal:     '#ffffff',
    toplink:    '#aaa',
    toplinkH:   '#fff',
    rowborder:  '#1e1e1e',
    proChip:    { bg:'#2a1f00', color:'#F4C300' },
    toggle:     { track:'#333', knob:'#666', activeTrack:'#F4C300', activeKnob:'#000' },
  } : {
    bg:         '#f4f2ee',
    topbar:     '#ffffff',
    topborder:  '#e8e4dc',
    card:       '#ffffff',
    cardborder: '#e8e4dc',
    cardhover:  '#fafafa',
    divider:    '#f0ede6',
    text1:      '#1a1917',
    text2:      '#4a4843',
    text3:      '#9a9590',
    text4:      '#c8c4bc',
    label:      '#9a9590',
    kpiVal:     '#1a1917',
    toplink:    '#9a9590',
    toplinkH:   '#1a1917',
    rowborder:  '#f0ede6',
    proChip:    { bg:'#fef4e0', color:'#9a5c10' },
    toggle:     { track:'#e8e4dc', knob:'#9a9590', activeTrack:'#1a1917', activeKnob:'#fff' },
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background: dark ? '#0f0f0f' : '#f4f2ee', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif', color:'#666' }}>
      Loading...
    </div>
  )

  const kpis = [
    { label:'Total Bookings', value: data.totalBookings ?? 0,   change: null },
    { label:'Upcoming',       value: data.upcomingBookings ?? 0, change: null },
    { label:'Customers',      value: data.totalCustomers ?? 0,  change: null },
    { label:'Revenue',        value: '$' + ((data.revenue ?? 0) / 100).toFixed(0), change: null },
  ]

  const sections = [
    {
      title: 'Bookings & Customers',
      items: [
        { label:'Bookings',  href:'/dashboard/bookings',  icon:'📋', desc:'Manage appointments',         feature: null },
        { label:'Customers', href:'/dashboard/customers', icon:'👥', desc:'Profiles & history',          feature: null },
      ]
    },
    {
      title: 'Schedule & Team',
      items: [
        { label:'Availability & Staff', href:'/dashboard/availability', icon:'📅', desc:'Hours, team schedules & job SMS', feature: null },
      ]
    },
    {
      title: 'Marketing',
      items: [
        { label:'Inbox',     href:'/dashboard/inbox',     icon:'📬', desc:'Customer emails',      feature:'inbox' },
        { label:'Campaigns', href:'/dashboard/campaigns', icon:'📣', desc:'Email & social posts', feature:'campaigns' },
      ]
    },
    {
      title: 'Settings',
      items: [
        { label:'Settings', href:'/dashboard/settings', icon:'⚙️', desc:'Branding & booking rules', feature: null },
      ]
    },
  ]

  const STATUS_COLORS: any = {
    pending:   '#9a5c10', confirmed: '#1a6b4a', completed: '#1e4d8c', cancelled: '#8c2820',
  }
  const STATUS_BG: any = {
    pending: dark ? '#2a1a00' : '#fef4e0',
    confirmed: dark ? '#0a2a1a' : '#e8f5ee',
    completed: dark ? '#0a1a2a' : '#eef4fb',
    cancelled: dark ? '#2a0a0a' : '#fdf0ef',
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={{ minHeight:'100vh', background:T.bg, fontFamily:"'DM Sans', sans-serif", color:T.text1, transition:'background 0.2s, color 0.2s' }}>

        {/* Top bar */}
        <div style={{ background:T.topbar, borderBottom:`1px solid ${T.topborder}`, padding:'0 28px', height:'56px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, transition:'background 0.2s' }}>
          <span style={{ fontFamily:'Barlow Condensed', fontSize:'20px', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em', color:T.text1 }}>
            {tenant?.name ?? 'Dashboard'}
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>

            {/* Theme toggle */}
            <button onClick={toggleTheme}
              style={{ display:'flex', alignItems:'center', gap:'7px', background:'none', border:`1px solid ${T.cardborder}`, borderRadius:'20px', padding:'5px 12px', cursor:'pointer', fontSize:'12px', color:T.text3, fontFamily:'DM Sans', transition:'all 0.15s' }}>
              <span>{dark ? '☀️' : '🌙'}</span>
              <span>{dark ? 'Light' : 'Dark'}</span>
            </button>

            <a href="/" target="_blank"
              style={{ fontSize:'12px', color:T.toplink, textDecoration:'none', border:`1px solid ${T.cardborder}`, padding:'5px 12px', borderRadius:'6px', transition:'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color=T.toplinkH}
              onMouseLeave={e => e.currentTarget.style.color=T.toplink}>
              View site ↗
            </a>
            <button onClick={signOut}
              style={{ background:'none', border:`1px solid ${T.cardborder}`, color:T.toplink, padding:'5px 14px', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontFamily:'DM Sans', transition:'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color=T.toplinkH}
              onMouseLeave={e => e.currentTarget.style.color=T.toplink}>
              Sign out
            </button>
          </div>
        </div>

        <div style={{ padding:'28px', maxWidth:'1000px', margin:'0 auto' }}>

          {/* Greeting */}
          <div style={{ marginBottom:'24px', animation:'fadeUp 0.3s ease both' }}>
            <h1 style={{ fontFamily:'Barlow Condensed', fontSize:'32px', fontWeight:800, textTransform:'uppercase', color:T.text1, marginBottom:'4px' }}>
              Overview
            </h1>
            <p style={{ fontSize:'13px', color:T.text3 }}>
              {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
            </p>
          </div>

          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'28px' }}>
            {kpis.map((k, i) => (
              <div key={k.label}
                style={{ background:T.card, border:`1px solid ${T.cardborder}`, borderRadius:'12px', padding:'20px 22px', animation:`fadeUp 0.4s ease ${i*0.05}s both`, transition:'background 0.2s, border-color 0.2s' }}>
                <div style={{ fontSize:'11px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.08em', color:T.text3, marginBottom:'10px' }}>{k.label}</div>
                <div style={{ fontFamily:'Barlow Condensed', fontSize:'36px', fontWeight:800, color:T.kpiVal, lineHeight:1 }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Main grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:'20px', alignItems:'start' }}>

            {/* Left: nav sections */}
            <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
              {sections.map((section, si) => (
                <div key={section.title} style={{ animation:`fadeUp 0.4s ease ${0.1+si*0.05}s both` }}>
                  <div style={{ fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.14em', color:T.label, marginBottom:'10px' }}>
                    {section.title}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'10px' }}>
                    {section.items.map(item => {
                      const locked = item.feature && tenant && !tenant.features[item.feature as keyof typeof tenant.features]
                      if (locked) {
                        return (
                          <button key={item.label}
                            onClick={() => setUpgradeFeature(item.feature!)}
                            style={{ background:T.card, border:`1px solid ${T.cardborder}`, borderRadius:'10px', padding:'18px', textAlign:'left', cursor:'pointer', fontFamily:'DM Sans', opacity:0.6, transition:'background 0.2s' }}>
                            <div style={{ fontSize:'22px', marginBottom:'10px' }}>{item.icon}</div>
                            <div style={{ fontSize:'13px', fontWeight:600, color:T.text2, marginBottom:'4px', display:'flex', alignItems:'center', gap:'6px' }}>
                              {item.label}
                              <span style={{ fontSize:'9px', padding:'2px 6px', background:T.proChip.bg, color:T.proChip.color, borderRadius:'8px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Pro</span>
                            </div>
                            <div style={{ fontSize:'11px', color:T.text3 }}>{item.desc}</div>
                          </button>
                        )
                      }
                      return (
                        <a key={item.label} href={item.href}
                          style={{ background:T.card, border:`1px solid ${T.cardborder}`, borderRadius:'10px', padding:'18px', textDecoration:'none', display:'block', transition:'border-color 0.15s, background 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor=dark?'#444':'#1a1917'; e.currentTarget.style.background=T.cardhover }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor=T.cardborder; e.currentTarget.style.background=T.card }}>
                          <div style={{ fontSize:'22px', marginBottom:'10px' }}>{item.icon}</div>
                          <div style={{ fontSize:'13px', fontWeight:600, color:T.text1, marginBottom:'4px' }}>{item.label}</div>
                          <div style={{ fontSize:'11px', color:T.text3 }}>{item.desc}</div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Right: recent bookings */}
            <div style={{ animation:'fadeUp 0.4s ease 0.2s both' }}>
              <div style={{ fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.14em', color:T.label, marginBottom:'10px' }}>
                Recent bookings
              </div>
              <div style={{ background:T.card, border:`1px solid ${T.cardborder}`, borderRadius:'12px', padding:'16px 20px', transition:'background 0.2s' }}>
                {recentBookings.length === 0 ? (
                  <div style={{ fontSize:'13px', color:T.text3, textAlign:'center', padding:'20px', fontStyle:'italic' }}>No bookings yet</div>
                ) : recentBookings.map((b: any) => (
                  <div key={b.id} style={{ display:'flex', alignItems:'center', padding:'11px 0', borderBottom:`1px solid ${T.rowborder}`, gap:'12px' }}>
                    <div key={b.id + 'inner'} style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'13px', fontWeight:500, color:T.text1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {b.customers?.first_name} {b.customers?.last_name}
                      </div>
                      <div style={{ fontSize:'11px', color:T.text3, marginTop:'2px' }}>
                        {b.services?.name} · {new Date(b.starts_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                      </div>
                    </div>
                    <span style={{ fontSize:'10px', fontWeight:600, padding:'3px 8px', borderRadius:'20px', background:STATUS_BG[b.status]??T.card, color:STATUS_COLORS[b.status]??T.text3, textTransform:'uppercase', letterSpacing:'0.04em', flexShrink:0 }}>
                      {b.status}
                    </span>
                  </div>
                ))}
                <a href="/dashboard/bookings"
                  style={{ display:'block', textAlign:'center', fontSize:'12px', color:T.text3, textDecoration:'none', marginTop:'12px', paddingTop:'12px', borderTop:`1px solid ${T.rowborder}`, transition:'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color=T.text1}
                  onMouseLeave={e => e.currentTarget.style.color=T.text3}>
                  View all bookings →
                </a>
              </div>

              {/* Chatbot teaser */}
              {tenant && !tenant.features.chatbot && (
                <div style={{ marginTop:'12px', background:T.card, border:`1px solid ${dark?'#F4C30033':T.cardborder}`, borderRadius:'12px', padding:'16px', transition:'background 0.2s' }}>
                  <div style={{ fontSize:'20px', marginBottom:'8px' }}>💬</div>
                  <div style={{ fontSize:'13px', fontWeight:600, color:T.text1, marginBottom:'4px' }}>AI Chatbot</div>
                  <div style={{ fontSize:'12px', color:T.text3, marginBottom:'12px', lineHeight:1.5 }}>
                    Capture leads and book appointments automatically, 24/7.
                  </div>
                  <button onClick={() => setUpgradeFeature('chatbot')}
                    style={{ width:'100%', padding:'8px', background:'#F4C300', color:'#000', border:'none', borderRadius:'6px', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'DM Sans', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                    Unlock Pro
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {upgradeFeature && (
        <UpgradeModal
          feature={upgradeFeature}
          plan={tenant?.plan ?? 'free'}
          onClose={() => setUpgradeFeature(null)}
        />
      )}
    </>
  )
}
