'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useTenant } from '@/lib/tenant-context'
import { useThemeTokens } from '@/lib/theme'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_COLOR: any = { pending:'#9a5c10', confirmed:'#1a6b4a', completed:'#1e4d8c', cancelled:'#8c2820' }

export default function OverviewPage() {
  const { tenant, theme, setTheme } = useTenant()
  const T = useThemeTokens()
  const [kpis, setKpis]     = useState<any>(null)
  const [recent, setRecent] = useState<any[]>([])

  useEffect(() => {
    if (!tenant?.id) return
    async function load() {
      const tid = tenant!.id
      const now  = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [b1, b2, b3, b4, rec] = await Promise.all([
        supabase.from('bookings').select('id', { count:'exact', head:true }).eq('tenant_id', tid),
        supabase.from('bookings').select('id', { count:'exact', head:true }).eq('tenant_id', tid).in('status', ['confirmed','pending']).gte('starts_at', now.toISOString()),
        supabase.from('bookings').select('price_cents').eq('tenant_id', tid).eq('status', 'completed').gte('starts_at', monthStart),
        supabase.from('bookings').select('id', { count:'exact', head:true }).eq('tenant_id', tid).in('status', ['confirmed','pending']).gte('starts_at', todayStart).lte('starts_at', todayEnd),
        supabase.from('bookings').select('id, status, starts_at, customers(first_name, last_name), services(name)').eq('tenant_id', tid).order('created_at', { ascending:false }).limit(6),
      ])

      const monthRevenue = (b3.data ?? []).reduce((s: number, b: any) => s + (b.price_cents ?? 0), 0)
      setKpis({ total: b1.count??0, upcoming: b2.count??0, monthRevenue, todayRemaining: b4.count??0 })
      setRecent(rec.data ?? [])
    }
    load()
  }, [tenant?.id])

  const statusBg = T.isDark
    ? { pending:'#2a1a00', confirmed:'#0a2a1a', completed:'#0a1a2a', cancelled:'#2a0a0a' }
    : { pending:'#fef4e0', confirmed:'#e8f5ee', completed:'#eef4fb', cancelled:'#fdf0ef' }

  const kpiCards = [
    { label:'Total bookings',    value: kpis ? String(kpis.total)                             : null },
    { label:'Upcoming',          value: kpis ? String(kpis.upcoming)                          : null },
    { label:'Month revenue',     value: kpis ? '$'+(kpis.monthRevenue/100).toFixed(0)         : null },
    { label:"Today's remaining", value: kpis ? String(kpis.todayRemaining)                    : null },
  ]

  return (
    <div style={{ minHeight:'100vh', background:T.bg, fontFamily:"'DM Sans',sans-serif", transition:'background 0.2s' }}>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
        .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
        .main-grid { display:grid; grid-template-columns:1fr 260px; gap:20px; align-items:start; }
        .quick-links { display:flex; flex-direction:column; gap:8px; }
        @media (max-width:768px) {
          .kpi-grid { grid-template-columns:repeat(2,1fr) !important; }
          .main-grid { grid-template-columns:1fr !important; }
          .quick-links { display:grid !important; grid-template-columns:repeat(2,1fr) !important; }
        }
      `}</style>

      {/* Top strip */}
      <div style={{ padding:'0 20px', height:'52px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${T.border}` }}>
        <div>
          <div style={{ fontFamily:'Barlow Condensed', fontSize:'20px', fontWeight:800, textTransform:'uppercase', color:T.t1 }}>Overview</div>
          <div style={{ fontSize:'11px', color:T.t3 }}>{new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}</div>
        </div>
        <button onClick={() => setTheme(theme==='dark'?'light':'dark')}
          style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:`1px solid ${T.border}`, borderRadius:'20px', padding:'5px 12px', cursor:'pointer', fontSize:'12px', color:T.t3, fontFamily:'DM Sans', transition:'all 0.15s' }}>
          <span>{T.isDark?'☀️':'🌙'}</span>
          <span>{T.isDark?'Light':'Dark'}</span>
        </button>
      </div>

      <div style={{ padding:'20px' }}>
        {/* KPIs */}
        <div className="kpi-grid">
          {kpiCards.map(k => (
            <div key={k.label} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', padding:'16px 18px', transition:'background 0.2s' }}>
              <div style={{ fontSize:'10px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.08em', color:T.t3, marginBottom:'8px' }}>{k.label}</div>
              {k.value == null
                ? <div style={{ width:'60px', height:'32px', background:T.isDark?'#222':'#ece8e0', borderRadius:'6px', animation:'pulse 1.5s ease infinite' }} />
                : <div style={{ fontFamily:'Barlow Condensed', fontSize:'32px', fontWeight:800, color:T.t1, lineHeight:1 }}>{k.value}</div>
              }
            </div>
          ))}
        </div>

        <div className="main-grid">
          {/* Recent bookings */}
          <div>
            <div style={{ fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.14em', color:T.label, marginBottom:'10px' }}>Recent bookings</div>
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'12px', overflow:'hidden', transition:'background 0.2s' }}>
              {recent.length===0 && kpis===null ? (
                [1,2,3,4].map(i => (
                  <div key={i} style={{ padding:'13px 20px', borderBottom:`1px solid ${T.divider}`, display:'flex', gap:'12px', alignItems:'center' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ width:'120px', height:'12px', background:T.isDark?'#222':'#ece8e0', borderRadius:'4px', marginBottom:'6px', animation:'pulse 1.5s ease infinite' }} />
                      <div style={{ width:'80px', height:'10px', background:T.isDark?'#1e1e1e':'#f0ede6', borderRadius:'4px', animation:'pulse 1.5s ease infinite' }} />
                    </div>
                    <div style={{ width:'60px', height:'18px', background:T.isDark?'#1e1e1e':'#f0ede6', borderRadius:'10px', animation:'pulse 1.5s ease infinite' }} />
                  </div>
                ))
              ) : recent.length===0 ? (
                <div style={{ padding:'40px', textAlign:'center', fontSize:'13px', color:T.t3, fontStyle:'italic' }}>No bookings yet</div>
              ) : recent.map((b:any) => (
                <div key={b.id} style={{ display:'flex', alignItems:'center', padding:'13px 20px', borderBottom:`1px solid ${T.divider}`, gap:'12px', transition:'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background=T.hover}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'13px', fontWeight:500, color:T.t1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {b.customers?.first_name} {b.customers?.last_name}
                    </div>
                    <div style={{ fontSize:'11px', color:T.t3, marginTop:'2px' }}>
                      {b.services?.name} · {new Date(b.starts_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                    </div>
                  </div>
                  <span style={{ fontSize:'10px', fontWeight:600, padding:'3px 8px', borderRadius:'20px', background:(statusBg as any)[b.status]??T.card, color:STATUS_COLOR[b.status]??T.t3, textTransform:'uppercase', letterSpacing:'0.04em', flexShrink:0, whiteSpace:'nowrap' }}>
                    {b.status}
                  </span>
                </div>
              ))}
              <a href="/dashboard/bookings"
                style={{ display:'block', textAlign:'center', fontSize:'12px', color:T.t3, textDecoration:'none', padding:'12px 20px', borderTop:`1px solid ${T.divider}`, transition:'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color=T.t1}
                onMouseLeave={e => e.currentTarget.style.color=T.t3}>
                View all bookings →
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <div style={{ fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.14em', color:T.label, marginBottom:'10px' }}>Quick actions</div>
            <div className="quick-links">
              {[
                { label:'New booking',         href:'/book',                   icon:'➕' },
                { label:'Manage bookings',     href:'/dashboard/bookings',     icon:'📋' },
                { label:'View customers',      href:'/dashboard/customers',    icon:'👥' },
                { label:'Staff & schedule',    href:'/dashboard/availability', icon:'📅' },
                { label:'Branding & settings', href:'/dashboard/settings',     icon:'⚙️' },
              ].map(q => (
                <a key={q.label} href={q.href}
                  style={{ display:'flex', alignItems:'center', gap:'10px', padding:'11px 14px', background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px', textDecoration:'none', transition:'border-color 0.15s, background 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor=T.isDark?'#444':'#1a1917'; e.currentTarget.style.background=T.hover }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=T.border; e.currentTarget.style.background=T.card }}>
                  <span style={{ fontSize:'16px', lineHeight:1 }}>{q.icon}</span>
                  <span style={{ fontSize:'13px', fontWeight:500, color:T.t1 }}>{q.label}</span>
                </a>
              ))}
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'12px 14px', transition:'background 0.2s' }}>
                <div style={{ fontSize:'10px', color:T.t3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px', fontWeight:600 }}>Your booking link</div>
                <div style={{ fontSize:'11px', color:T.isDark?'#F4C300':'#1a1917', fontFamily:'monospace', wordBreak:'break-all', marginBottom:'8px' }}>
                  trades-sass.vercel.app/book
                </div>
                <button onClick={() => navigator.clipboard.writeText('https://trades-sass.vercel.app/book')}
                  style={{ width:'100%', padding:'6px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:'5px', fontSize:'11px', color:T.t3, cursor:'pointer', fontFamily:'DM Sans', transition:'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor=T.isDark?'#444':'#1a1917'; e.currentTarget.style.color=T.t1 }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.t3 }}>
                  Copy link
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
