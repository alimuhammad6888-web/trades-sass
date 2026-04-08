'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { TenantProvider } from '@/lib/tenant-context'
import { type Tenant, DEFAULT_FEATURES } from '@/lib/tenant'
import { hasFeature } from '@/lib/features'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const NAV_ITEMS = [
  { label:'Overview',         href:'/dashboard',              icon:'📊', feature:null },
  { label:'Bookings',         href:'/dashboard/bookings',     icon:'📋', feature:null },
  { label:'Customers',        href:'/dashboard/customers',    icon:'👥', feature:null },
  { label:'Services',         href:'/dashboard/services',     icon:'🛠️',  feature:null },
  { label:'Schedule & Staff', href:'/dashboard/availability', icon:'📅', feature:null },
  { label:'Inbox',            href:'/dashboard/inbox',        icon:'📬', feature:'advanced_crm' },
  { label:'Campaigns',        href:'/dashboard/campaigns',    icon:'📣', feature:'social_automation' },
  { label:'Settings',         href:'/dashboard/settings',     icon:'⚙️',  feature:null },
  { label:'Billing',          href:'/dashboard/billing',      icon:'💳', feature:null },
] as const

export default function DashboardAppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [tenant, setTenant]           = useState<Tenant | null>(null)
  const [loading, setLoading]         = useState(true)
  const [collapsed, setCollapsed]     = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [logoUrl, setLogoUrl]         = useState<string | null>(null)
  const [settingsId, setSettingsId]   = useState<string | null>(null)

  const [theme, setThemeState] = useState<'dark' | 'light'>('dark')

  const setTheme = useCallback(async (t: 'dark' | 'light') => {
    setThemeState(t)
    localStorage.setItem('dash-theme', t)
    if (settingsId) {
      await supabase.from('business_settings').update({ dashboard_theme: t }).eq('id', settingsId)
    }
  }, [settingsId])

  useEffect(() => {
    const saved = localStorage.getItem('dash-theme') as 'dark' | 'light' | null
    if (saved) setThemeState(saved)

    const sidebarSaved = localStorage.getItem('dash-sidebar')
    if (sidebarSaved === 'collapsed') setCollapsed(true)
  }, [])

  useEffect(() => {
    let mounted = true

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      if (!user) {
        router.push('/dashboard/login')
        return
      }

      const { data: userRow } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('auth_user_id', user.id)
        .single()

      if (!mounted) return
      if (!userRow?.tenant_id) {
        router.push('/dashboard/login')
        return
      }

      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id, name, slug, plan, business_settings(id, features, logo_url, dashboard_theme)')
        .eq('id', userRow.tenant_id)
        .single()

      if (!mounted) return
      if (!tenantData) {
        router.push('/dashboard/login')
        return
      }

      const settings = Array.isArray(tenantData.business_settings)
        ? tenantData.business_settings[0]
        : tenantData.business_settings

      setTenant({
        id:       tenantData.id,
        name:     tenantData.name,
        slug:     tenantData.slug,
        plan:     tenantData.plan,
        features: { ...DEFAULT_FEATURES, ...(settings?.features ?? {}) },
      })

      if (settings?.logo_url) setLogoUrl(settings.logo_url)
      if (settings?.id) setSettingsId(settings.id)

      if (settings?.dashboard_theme) {
        setThemeState(settings.dashboard_theme)
        localStorage.setItem('dash-theme', settings.dashboard_theme)
      }

      setLoading(false)
    }

    init()

    return () => {
      mounted = false
    }
  }, [router])

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('dash-sidebar', next ? 'collapsed' : 'expanded')
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/dashboard/login')
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const dark = theme === 'dark'
  const S = {
    bg:           dark ? '#111111' : '#ffffff',
    border:       dark ? '#1a1a1a' : '#e8e4dc',
    activeBg:     dark ? '#1e1e1e' : '#f0ede6',
    hoverBg:      dark ? '#161616' : '#f8f5f0',
    text:         dark ? '#aaaaaa' : '#9a9590',
    activeText:   dark ? '#ffffff' : '#1a1917',
    subtext:      dark ? '#555555' : '#c8c4bc',
    logoBg:       dark ? '#F4C300' : '#1a1917',
    logoText:     dark ? '#000000' : '#ffffff',
    contentBg:    dark ? '#0f0f0f' : '#f4f2ee',
    topbarBg:     dark ? '#111111' : '#ffffff',
    topbarBorder: dark ? '#1a1a1a' : '#e8e4dc',
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => {
    const labels = mobile || !collapsed

    return (
      <div style={{ display:'flex', flexDirection:'column', height:'100%', background:S.bg, transition:'background 0.2s' }}>

        <div style={{ padding:labels?'18px 16px':'18px 0', borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', gap:'10px', justifyContent:labels?'flex-start':'center', minHeight:'68px' }}>
          {logoUrl ? (
            <img src={logoUrl} alt="logo" style={{ width:'34px', height:'34px', borderRadius:'6px', objectFit:'cover', flexShrink:0 }} />
          ) : (
            <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:S.logoBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:800, color:S.logoText, flexShrink:0, fontFamily:'Barlow Condensed,sans-serif', transition:'background 0.2s, color 0.2s' }}>
              {tenant?.name?.[0] ?? '⚡'}
            </div>
          )}
          {labels && (
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:'14px', fontWeight:700, color:S.activeText, fontFamily:'Barlow Condensed,sans-serif', textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', transition:'color 0.2s' }}>
                {tenant?.name ?? '...'}
              </div>
              <div style={{ fontSize:'11px', color:S.subtext, marginTop:'1px', transition:'color 0.2s' }}>Owner dashboard</div>
            </div>
          )}
        </div>

        <nav style={{ flex:1, padding:'10px 8px', overflowY:'auto' }}>
          {NAV_ITEMS.map(item => {
            const locked = Boolean(
              item.feature &&
              tenant &&
              !hasFeature(tenant, item.feature)
            )

            const active = isActive(item.href)

            if (locked) {
              return (
                <button
                  key={item.label}
                  onClick={() => { setUpgradeOpen(true); setMobileOpen(false) }}
                  title={!labels ? item.label : undefined}
                  style={{
                    width:'100%',
                    display:'flex',
                    alignItems:'center',
                    gap:'10px',
                    padding:labels?'10px 12px':'10px 0',
                    justifyContent:labels?'flex-start':'center',
                    background:'transparent',
                    border:'none',
                    borderRadius:'8px',
                    cursor:'pointer',
                    fontFamily:'DM Sans,sans-serif',
                    opacity:0.4,
                    marginBottom:'2px',
                  }}
                >
                  <span style={{ fontSize:'18px', flexShrink:0, lineHeight:1 }}>{item.icon}</span>
                  {labels && (
                    <>
                      <span style={{ fontSize:'13px', fontWeight:500, color:S.text, flex:1, textAlign:'left' }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize:'9px', padding:'2px 5px', background:'#2a1f00', color:'#F4C300', borderRadius:'4px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                        Pro
                      </span>
                    </>
                  )}
                </button>
              )
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={!labels ? item.label : undefined}
                style={{
                  display:'flex',
                  alignItems:'center',
                  gap:'10px',
                  padding:labels?'10px 12px':'10px 0',
                  justifyContent:labels?'flex-start':'center',
                  background:active?S.activeBg:'transparent',
                  borderRadius:'8px',
                  textDecoration:'none',
                  marginBottom:'2px',
                  transition:'background 0.15s',
                  borderLeft:active?'3px solid #F4C300':'3px solid transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = S.hoverBg }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize:'18px', flexShrink:0, lineHeight:1 }}>{item.icon}</span>
                {labels && (
                  <span style={{ fontSize:'13px', fontWeight:active?600:500, color:active?S.activeText:S.text, transition:'color 0.2s' }}>
                    {item.label}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding:'10px 8px', borderTop:`1px solid ${S.border}` }}>
          {labels && (
            <Link
              href="/"
              target="_blank"
              style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'8px', textDecoration:'none', marginBottom:'2px', transition:'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = S.hoverBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize:'18px', lineHeight:1 }}>🌐</span>
              <span style={{ fontSize:'13px', color:S.subtext, fontWeight:500, transition:'color 0.2s' }}>View site</span>
            </Link>
          )}

          <button
            onClick={signOut}
            title={!labels ? 'Sign out' : undefined}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:labels?'9px 12px':'10px 0', justifyContent:labels?'flex-start':'center', background:'transparent', border:'none', borderRadius:'8px', cursor:'pointer', fontFamily:'DM Sans,sans-serif', marginBottom:'2px', transition:'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = S.hoverBg}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize:'18px', lineHeight:1 }}>🚪</span>
            {labels && <span style={{ fontSize:'13px', color:S.subtext, fontWeight:500, transition:'color 0.2s' }}>Sign out</span>}
          </button>

          {!mobile && (
            <button
              onClick={toggleCollapse}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:labels?'9px 12px':'10px 0', justifyContent:labels?'flex-start':'center', background:'transparent', border:'none', borderRadius:'8px', cursor:'pointer', fontFamily:'DM Sans,sans-serif', transition:'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = S.hoverBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize:'14px', display:'inline-block', transform:collapsed?'rotate(180deg)':'none', transition:'transform 0.2s', color:S.subtext }}>◀</span>
              {labels && <span style={{ fontSize:'12px', color:S.subtext, fontWeight:500 }}>Collapse</span>}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <TenantProvider tenant={tenant} loading={loading} theme={theme} setTheme={setTheme}>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body { font-family: 'DM Sans', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
        @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar   { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-topbar { display: none !important; }
        }
      `}</style>

      <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:S.contentBg, transition:'background 0.2s' }}>

        <div className="desktop-sidebar" style={{ width:collapsed?'60px':'220px', flexShrink:0, borderRight:`1px solid ${S.border}`, display:'flex', flexDirection:'column', transition:'width 0.2s ease', overflow:'hidden', height:'100vh', position:'sticky', top:0 }}>
          <Sidebar />
        </div>

        <div className="mobile-topbar" style={{ display:'none', position:'fixed', top:0, left:0, right:0, height:'52px', background:S.topbarBg, borderBottom:`1px solid ${S.topbarBorder}`, zIndex:50, alignItems:'center', padding:'0 16px', gap:'12px', transition:'background 0.2s' }}>
          <button onClick={() => setMobileOpen(true)} style={{ background:'none', border:'none', color:S.activeText, fontSize:'22px', cursor:'pointer', padding:'4px', lineHeight:1 }}>☰</button>
          <span style={{ fontFamily:'Barlow Condensed', fontSize:'18px', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em', color:S.activeText, transition:'color 0.2s' }}>
            {tenant?.name ?? 'Dashboard'}
          </span>
        </div>

        {mobileOpen && (
          <div onClick={() => setMobileOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:60 }}>
            <div onClick={e => e.stopPropagation()} style={{ position:'absolute', top:0, left:0, bottom:0, width:'260px', borderRight:`1px solid ${S.border}`, animation:'slideIn 0.2s ease' }}>
              <button onClick={() => setMobileOpen(false)} style={{ position:'absolute', top:'16px', right:'16px', background:'none', border:'none', color:S.subtext, fontSize:'22px', cursor:'pointer', zIndex:1 }}>×</button>
              <Sidebar mobile />
            </div>
          </div>
        )}

        <div style={{ flex:1, overflowY:'auto', overflowX:'hidden' }}>
          <style>{`@media (max-width: 768px) { .mob-pad { padding-top: 52px !important; } }`}</style>
          <div className="mob-pad">{children}</div>
        </div>
      </div>

      {upgradeOpen && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'20px' }}
          onClick={() => setUpgradeOpen(false)}
        >
          <div
            style={{ background:'#fff', borderRadius:'12px', padding:'32px', maxWidth:'400px', width:'100%', color:'#1a1917' }}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setUpgradeOpen(false)} style={{ float:'right', background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#9a9590' }}>×</button>
            <div style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#9a5c10', background:'#fef4e0', padding:'4px 12px', borderRadius:'20px', display:'inline-block', marginBottom:'16px' }}>
              Pro feature
            </div>
            <h2 style={{ fontFamily:'Georgia,serif', fontSize:'20px', fontStyle:'italic', marginBottom:'8px' }}>
              Upgrade to unlock
            </h2>
            <p style={{ fontSize:'14px', color:'#9a9590', lineHeight:1.6, marginBottom:'20px' }}>
              Available on the Pro plan at $99/month.
            </p>
            <button
              onClick={() => {
                setUpgradeOpen(false)
                router.push('/dashboard/billing')
              }}
              style={{ width:'100%', padding:'11px', background:'#1a1917', color:'#fff', border:'none', borderRadius:'6px', fontSize:'14px', fontWeight:500, cursor:'pointer', fontFamily:'sans-serif' }}
            >
              View plans
            </button>
          </div>
        </div>
      )}
    </TenantProvider>
  )
}