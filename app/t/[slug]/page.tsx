// Server Component — no 'use client'
// Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS (same as the API route).
// Schema matched exactly to app/api/public/tenant-by-slug/route.ts
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { adjustHex, getTenantTheme, tenantPublicChrome } from '@/lib/tenant-theme'

const SERVICE_ICONS: Record<string, string> = {
  'Panel Upgrade': '⚡', 'EV Charger Install': '🔌', 'Ceiling Fan Install': '💨',
  'Breaker Replacement': '🔧', 'Outlet Installation': '🔲', 'Lighting Install': '💡',
  'Safety Inspection': '🛡️', 'Emergency Service': '🚨',
}

function formatPrice(cents: number | null) {
  return cents ? '$' + (cents / 100).toFixed(0) : 'Get a quote'
}

export default async function LandingPage({ params }: { params: { slug: string } }) {
  const { slug } = params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, is_active')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.is_active) notFound()

  const { data: settings } = await supabase
    .from('business_settings')
    .select('tagline, primary_color, accent_color, bg_color, text_color, phone, booking_lead_time_hours, booking_window_days')
    .eq('tenant_id', tenant.id)
    .single()

  const [{ data: services }, { data: siteContent }] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, description, price_cents')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('display_order'),
    supabase
      .from('tenant_site_content')
      .select('hero_headline, hero_subheadline, hero_badge, stats_json, why_us_json, cta_primary_text, cta_secondary_text, cta_description, footer_tagline, is_published')
      .eq('tenant_id', tenant.id)
      .maybeSingle(),
  ])

  const { brand, accent, bg, text, bgSurface, bgDeep, bgBorder, textMuted } = getTenantTheme(settings)

  const stats = siteContent?.stats_json  || []
  const whyUs = siteContent?.why_us_json || []
  const isDev = process.env.NODE_ENV === 'development'

  if (siteContent?.is_published === false && !isDev) {
    return (
      <div style={{ minHeight:'100vh', background:bg, color:text, fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center', maxWidth:'400px', padding:'40px 20px' }}>
          <div style={{ fontSize:'48px', marginBottom:'16px' }}>🚧</div>
          <h2 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'28px', fontWeight:900, textTransform:'uppercase', marginBottom:'8px', color:text }}>{tenant.name}</h2>
          <p style={{ color:textMuted, fontSize:'14px', lineHeight:1.6 }}>Our website is coming soon. In the meantime, you can still book a service.</p>
          <a href={`/book/${slug}`} style={{ display:'inline-block', marginTop:'20px', padding:'12px 28px', background:brand, color:bg, fontFamily:"'Barlow Condensed',sans-serif", fontSize:'16px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', textDecoration:'none' }}>
            Book now
          </a>
        </div>
      </div>
    )
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        ${tenantPublicChrome.fontImport}
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html { scroll-behavior:smooth; }
        body { background:${bg}; color:${text}; font-family:'DM Sans',sans-serif; -webkit-font-smoothing:antialiased; }

        @keyframes spark-1 { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(-40px,-80px) scale(0);opacity:0} }
        @keyframes spark-2 { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(30px,-90px) scale(0);opacity:0} }
        @keyframes spark-3 { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(-20px,-70px) scale(0);opacity:0} }
        @keyframes spark-4 { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(50px,-60px) scale(0);opacity:0} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 20px ${brand}44} 50%{box-shadow:0 0 40px ${brand}88} }
        @keyframes slide-up { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bolt { 0%,90%,100%{opacity:0} 92%{opacity:1} 94%{opacity:0.4} 96%{opacity:1} }
        @keyframes fade-in { from{opacity:0} to{opacity:1} }

        .spark { position:absolute; width:4px; height:4px; border-radius:50%; background:${brand}; pointer-events:none; }
        .spark:nth-child(1){bottom:10px;left:20px;animation:spark-1 1.4s ease-out infinite}
        .spark:nth-child(2){bottom:15px;left:40px;animation:spark-2 1.8s ease-out infinite 0.3s}
        .spark:nth-child(3){bottom:8px;left:60px;animation:spark-3 1.2s ease-out infinite 0.6s}
        .spark:nth-child(4){bottom:12px;left:80px;animation:spark-4 1.6s ease-out infinite 0.9s}
        .spark:nth-child(5){bottom:6px;left:100px;animation:spark-1 1.3s ease-out infinite 0.2s}
        .spark:nth-child(6){bottom:14px;left:120px;animation:spark-2 1.7s ease-out infinite 0.7s}

        .hero-title { font-family:'Barlow Condensed',sans-serif; font-size:clamp(64px,12vw,130px); font-weight:900; line-height:0.88; text-transform:uppercase; letter-spacing:-0.02em; animation:slide-up 0.8s ease both; color:${text}; }
        .book-btn { display:inline-flex; align-items:center; gap:10px; padding:16px 36px; background:${brand}; color:${bg}; font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; border:none; cursor:pointer; text-decoration:none; animation:slide-up 0.8s ease 0.4s both, pulse-glow 3s ease-in-out infinite; transition:transform 0.15s; }
        .book-btn:hover { transform:scale(1.03); }
        .grid-bg { position:absolute; inset:0; background-image:linear-gradient(${brand}08 1px,transparent 1px),linear-gradient(90deg,${brand}08 1px,transparent 1px); background-size:60px 60px; pointer-events:none; }
        .bolt-deco { font-size:220px; line-height:1; color:${brand}; opacity:0.03; position:absolute; right:3%; top:50%; transform:translateY(-50%); pointer-events:none; animation:bolt 4s ease-in-out infinite; user-select:none; }

        .services-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:${bgBorder}; border:1px solid ${bgBorder}; border-radius:12px; overflow:hidden; }
        .service-card { background:${bgSurface}; padding:28px 24px; position:relative; overflow:hidden; transition:background 0.2s; display:flex; flex-direction:column; gap:10px; }
        .service-card::after { content:''; position:absolute; inset:0; background:linear-gradient(135deg,${brand}08 0%,transparent 60%); opacity:0; transition:opacity 0.3s; }
        .service-card:hover { background:${adjustHex(bgSurface, 6)}; }
        .service-card:hover::after { opacity:1; }
        .service-card:hover .service-icon { transform:scale(1.1); color:${accent}; }
        .service-card:hover .service-bar { transform:scaleX(1); }
        .service-bar { position:absolute; top:0; left:0; right:0; height:2px; background:${brand}; transform:scaleX(0); transform-origin:left; transition:transform 0.3s ease; }
        .service-icon { font-size:28px; line-height:1; transition:transform 0.2s,color 0.2s; display:block; margin-bottom:4px; }
        .service-name { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:${text}; line-height:1.1; }
        .service-desc { font-size:12px; color:${textMuted}; line-height:1.5; flex:1; }
        .service-price { font-size:13px; color:${accent}; font-weight:600; font-family:'Barlow Condensed',sans-serif; letter-spacing:0.05em; }
        .service-arrow { position:absolute; bottom:20px; right:20px; color:${accent}; opacity:0; transition:opacity 0.2s,transform 0.2s; font-size:18px; }
        .service-card:hover .service-arrow { opacity:1; transform:translate(2px,-2px); }

        .nav { position:fixed; top:0; left:0; right:0; z-index:100; padding:${tenantPublicChrome.navPadding}; height:${tenantPublicChrome.navHeight}; display:flex; align-items:center; justify-content:space-between; background:${bg}f2; backdrop-filter:blur(12px); border-bottom:1px solid ${bgBorder}; }
        .nav-logo { font-family:'Barlow Condensed',sans-serif; font-size:${tenantPublicChrome.navLogoFontSize}; font-weight:${tenantPublicChrome.navLogoFontWeight}; text-transform:uppercase; letter-spacing:${tenantPublicChrome.navLogoLetterSpacing}; color:${text}; }
        .nav-logo span { color:${accent}; }
        .nav-links { display:flex; align-items:center; gap:24px; }
        .nav-link { color:${textMuted}; font-size:13px; text-decoration:none; transition:color 0.15s; font-weight:500; }
        .nav-link:hover { color:${text}; }
        .nav-book { padding:${tenantPublicChrome.navButtonPadding}; background:${brand}; color:${bg}; font-family:'Barlow Condensed',sans-serif; font-size:${tenantPublicChrome.navButtonFontSize}; font-weight:700; text-transform:uppercase; letter-spacing:${tenantPublicChrome.navButtonLetterSpacing}; text-decoration:none; transition:opacity 0.15s; }
        .nav-book:hover { opacity:0.88; }

        .why-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:${bgBorder}; border:1px solid ${bgBorder}; border-radius:12px; overflow:hidden; }
        .why-card { background:${bgSurface}; padding:32px 28px; }
        .why-num { font-family:'Barlow Condensed',sans-serif; font-size:64px; font-weight:900; color:${accent}; line-height:1; margin-bottom:8px; opacity:0.9; }
        .why-title { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px; color:${text}; }
        .why-desc { font-size:13px; color:${textMuted}; line-height:1.6; }
        .cta-banner { background:${brand}; padding:60px 40px; text-align:center; }

        .view-all-link { transition:border-color 0.15s,color 0.15s; }
        .view-all-link:hover { border-color:${accent} !important; color:${accent} !important; }
        .hero-phone-link { transition:color 0.15s; }
        .hero-phone-link:hover { color:${accent} !important; }
        .cta-book-link { transition:opacity 0.15s; }
        .cta-book-link:hover { opacity:0.85; }

        @media (max-width:900px) { .services-grid{grid-template-columns:repeat(2,1fr)} .why-grid{grid-template-columns:1fr} .nav-links .nav-link{display:none} }
        @media (max-width:500px) { .services-grid{grid-template-columns:1fr} .nav{padding:${tenantPublicChrome.navPaddingMobile}} .bolt-deco{display:none} }
      `}</style>

      <nav className="nav">
        <div className="nav-logo">{tenant.name}</div>
        <div className="nav-links">
          <a href="#services" className="nav-link">Services</a>
          <a href="#why" className="nav-link">Why us</a>
          <a href={settings?.phone ? `tel:${settings.phone.replace(/[^\d]/g,'')}` : '#'} className="nav-link">{settings?.phone || 'Contact us'}</a>
          <a href={`/book/${slug}`} className="nav-book">Book now</a>
        </div>
      </nav>

      <div style={{ position:'relative', minHeight:'100vh', display:'flex', alignItems:'center', overflow:'hidden', paddingTop:'60px', background:bg }}>
        <div className="grid-bg" />
        <div className="bolt-deco">⚡</div>
        <div style={{ padding:'0 40px', maxWidth:'1100px', margin:'0 auto', width:'100%' }}>
          <div style={{ marginBottom:'16px', animation:'slide-up 0.6s ease both' }}>
            <span style={{ fontFamily:'Barlow Condensed', fontSize:'clamp(13px,2vw,16px)', fontWeight:600, letterSpacing:'0.2em', textTransform:'uppercase', color:accent }}>
              {siteContent?.hero_badge || (settings?.tagline ? 'Trusted local service' : 'Professional local service')}
            </span>
          </div>
          <h1 className="hero-title">{siteContent?.hero_headline || tenant.name}</h1>
          <div style={{ position:'relative', display:'inline-block', marginTop:'12px', marginBottom:'36px' }}>
            <p style={{ fontFamily:'Barlow Condensed', fontSize:'clamp(18px,3.5vw,32px)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', color:textMuted, animation:'slide-up 0.8s ease 0.15s both' }}>
              {siteContent?.hero_subheadline || settings?.tagline || 'Professional service you can trust.'}
            </p>
            <span className="spark"/><span className="spark"/><span className="spark"/>
            <span className="spark"/><span className="spark"/><span className="spark"/>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'24px', flexWrap:'wrap', animation:'slide-up 0.8s ease 0.3s both' }}>
            <a href={`/book/${slug}`} className="book-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill={bg}/></svg>
              {siteContent?.cta_primary_text || 'Book a service'}
            </a>
            <a href={settings?.phone ? `tel:${settings.phone.replace(/[^\d]/g,'')}` : '#'} className="hero-phone-link" style={{ color:textMuted, fontSize:'14px', textDecoration:'none', letterSpacing:'0.05em', animation:'slide-up 0.8s ease 0.4s both' }}>
              {settings?.phone || 'Contact us'}
            </a>
          </div>
          <div style={{ position:'absolute', bottom:'40px', left:'40px', display:'flex', alignItems:'center', gap:'8px', animation:'fade-in 1s ease 1s both' }}>
            <div style={{ width:'1px', height:'40px', background:`linear-gradient(to bottom, transparent, ${bgBorder})` }}/>
            <span style={{ fontSize:'10px', color:textMuted, textTransform:'uppercase', letterSpacing:'0.15em', fontWeight:500 }}>Scroll</span>
          </div>
        </div>
      </div>

      <div style={{ background:brand, padding:'32px 40px' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'20px', textAlign:'center' }}>
          {(stats.length > 0 ? stats : [
            { value:'Fast', label:'Response times' }, { value:'Top',   label:'Rated service'  },
            { value:'Easy', label:'Online booking' }, { value:'Local', label:'Trusted team'   },
          ]).map((s: any, i: number) => (
            <div key={i} style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <div style={{ fontFamily:'Barlow Condensed', fontSize:'clamp(32px,5vw,48px)', fontWeight:900, color:bg, lineHeight:1 }}>{s.value || s.num}</div>
              <div style={{ fontSize:'11px', color:adjustHex(bg, 60), textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div id="services" style={{ background:bg, padding:'80px 40px' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'40px', flexWrap:'wrap', gap:'16px' }}>
            <div>
              <div style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.2em', color:accent, marginBottom:'8px' }}>What we do</div>
              <h2 style={{ fontFamily:'Barlow Condensed', fontSize:'clamp(40px,7vw,72px)', fontWeight:900, textTransform:'uppercase', lineHeight:0.9, letterSpacing:'-0.01em', color:text }}>Our<br />Services</h2>
            </div>
            <a href={`/book/${slug}`} className="view-all-link" style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'12px 24px', border:`1.5px solid ${bgBorder}`, borderRadius:'4px', color:textMuted, fontSize:'13px', fontWeight:500, textDecoration:'none', whiteSpace:'nowrap' }}>
              View all services →
            </a>
          </div>
          {services && services.length > 0 ? (
            <div className="services-grid">
              {services.map(sv => (
                <a href={`/book/${slug}`} key={sv.id} className="service-card" style={{ textDecoration:'none' }}>
                  <div className="service-bar"/>
                  <span className="service-icon">{SERVICE_ICONS[sv.name] ?? '⚡'}</span>
                  <div className="service-name">{sv.name}</div>
                  <div className="service-desc">{sv.description}</div>
                  <div className="service-price">{formatPrice(sv.price_cents)}</div>
                  <span className="service-arrow">↗</span>
                </a>
              ))}
            </div>
          ) : (
            <div style={{ border:`1px solid ${bgBorder}`, borderRadius:'12px', padding:'60px 40px', textAlign:'center' }}>
              <div style={{ fontSize:'48px', marginBottom:'16px' }}>🔧</div>
              <h3 style={{ fontFamily:'Barlow Condensed', fontSize:'24px', fontWeight:700, textTransform:'uppercase', color:text, marginBottom:'8px' }}>Services coming soon</h3>
              <p style={{ fontSize:'14px', color:textMuted, lineHeight:1.6, maxWidth:'400px', margin:'0 auto 24px' }}>We're setting up our online booking. Give us a call to schedule.</p>
              {settings?.phone && (
                <a href={`tel:${settings.phone.replace(/[^\d]/g,'')}`} style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'14px 28px', background:brand, color:bg, fontFamily:'Barlow Condensed', fontSize:'18px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', textDecoration:'none' }}>
                  📞 Call {settings.phone}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div id="why" style={{ background:bgDeep, padding:'80px 40px' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
          <div style={{ marginBottom:'40px' }}>
            <div style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.2em', color:accent, marginBottom:'8px' }}>Why choose us</div>
            <h2 style={{ fontFamily:'Barlow Condensed', fontSize:'clamp(40px,7vw,72px)', fontWeight:900, textTransform:'uppercase', lineHeight:0.9, color:text }}>Why choose<br />{tenant.name}</h2>
          </div>
          <div className="why-grid">
            {(whyUs.length > 0 ? whyUs : [
              { title:'Same-day service', desc:'Most jobs booked before noon are completed the same day.' },
              { title:'Upfront pricing',  desc:'No surprises. We give you a firm quote before work begins.' },
              { title:'Fully licensed',   desc:'All work is performed by licensed professionals.' },
            ]).map((w: any, i: number) => (
              <div key={i} className="why-card">
                <div className="why-num">{String(i+1).padStart(2,'0')}</div>
                <div className="why-title">{w.title}</div>
                <div className="why-desc">{w.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cta-banner">
        <div style={{ maxWidth:'600px', margin:'0 auto' }}>
          <h2 style={{ fontFamily:'Barlow Condensed', fontSize:'clamp(40px,8vw,80px)', fontWeight:900, textTransform:'uppercase', color:bg, lineHeight:0.9, marginBottom:'20px' }}>
            {siteContent?.cta_secondary_text || 'Ready to get started?'}
          </h2>
          <p style={{ fontSize:'16px', color:adjustHex(bg, 60), marginBottom:'28px', lineHeight:1.6 }}>
            {siteContent?.cta_description || `Book online in 60 seconds or call us directly. ${settings?.tagline || ''}`}
          </p>
          <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
            <a href={`/book/${slug}`} className="cta-book-link" style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'14px 32px', background:bg, color:accent, fontFamily:'Barlow Condensed', fontSize:'18px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', textDecoration:'none' }}>
              ⚡ {siteContent?.cta_primary_text || 'Book now'}
            </a>
            <a href={settings?.phone ? `tel:${settings.phone.replace(/[^\d]/g,'')}` : '#'} style={{ display:'inline-flex', alignItems:'center', padding:'14px 32px', background:'transparent', color:bg, border:`2px solid ${bg}`, fontFamily:'Barlow Condensed', fontSize:'18px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', textDecoration:'none' }}>
              {settings?.phone || 'Contact us'}
            </a>
          </div>
        </div>
      </div>

      <div style={{ background:bgDeep, borderTop:`1px solid ${bgBorder}`, padding:'24px 40px' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
          <div style={{ fontFamily:'Barlow Condensed', fontSize:'18px', fontWeight:900, textTransform:'uppercase', color:text }}>{tenant.name}</div>
          <div style={{ fontSize:'12px', color:textMuted }}>{siteContent?.footer_tagline || settings?.tagline || 'Professional service you can trust.'}</div>
        </div>
      </div>
    </>
  )
}
