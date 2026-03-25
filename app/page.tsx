'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TENANT_ID = '11111111-1111-1111-1111-111111111111'

const SERVICE_ICONS: Record<string, string> = {
  'Panel Upgrade':       '⚡',
  'EV Charger Install':  '🔌',
  'Ceiling Fan Install': '💨',
  'Breaker Replacement': '🔧',
  'Outlet Installation': '🔲',
  'Lighting Install':    '💡',
  'Safety Inspection':   '🛡️',
  'Emergency Service':   '🚨',
}

export default function LandingPage() {
  const [services, setServices] = useState<any[]>([])

  useEffect(() => {
    supabase
      .from('services')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('display_order')
      .limit(8)
      .then(({ data }) => setServices(data ?? []))
  }, [])

  function formatPrice(cents: number | null) {
    if (!cents) return 'Get a quote'
    return '$' + (cents / 100).toFixed(0)
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Sans:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #0a0a0a; color: #fff; font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }

        @keyframes spark-1 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(-40px,-80px) scale(0); opacity: 0; } }
        @keyframes spark-2 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(30px,-90px) scale(0); opacity: 0; } }
        @keyframes spark-3 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(-20px,-70px) scale(0); opacity: 0; } }
        @keyframes spark-4 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(50px,-60px) scale(0); opacity: 0; } }
        @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 20px #F4C30044; } 50% { box-shadow: 0 0 40px #F4C30088; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bolt { 0%,90%,100% { opacity: 0; } 92% { opacity: 1; } 94% { opacity: 0.4; } 96% { opacity: 1; } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

        .spark { position: absolute; width: 4px; height: 4px; border-radius: 50%; background: #F4C300; pointer-events: none; }
        .spark:nth-child(1) { bottom: 10px; left: 20px;  animation: spark-1 1.4s ease-out infinite; }
        .spark:nth-child(2) { bottom: 15px; left: 40px;  animation: spark-2 1.8s ease-out infinite 0.3s; }
        .spark:nth-child(3) { bottom: 8px;  left: 60px;  animation: spark-3 1.2s ease-out infinite 0.6s; }
        .spark:nth-child(4) { bottom: 12px; left: 80px;  animation: spark-4 1.6s ease-out infinite 0.9s; }
        .spark:nth-child(5) { bottom: 6px;  left: 100px; animation: spark-1 1.3s ease-out infinite 0.2s; }
        .spark:nth-child(6) { bottom: 14px; left: 120px; animation: spark-2 1.7s ease-out infinite 0.7s; }

        .hero-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: clamp(64px, 12vw, 130px);
          font-weight: 900;
          line-height: 0.88;
          text-transform: uppercase;
          letter-spacing: -0.02em;
          animation: slide-up 0.8s ease both;
        }

        .book-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 16px 36px;
          background: #F4C300;
          color: #000;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 20px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          border: none;
          cursor: pointer;
          text-decoration: none;
          animation: slide-up 0.8s ease 0.4s both, pulse-glow 3s ease-in-out infinite;
          transition: transform 0.15s;
        }
        .book-btn:hover { transform: scale(1.03); }

        .grid-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(244,195,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(244,195,0,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
        }

        .bolt-deco {
          font-size: 220px;
          line-height: 1;
          color: #F4C300;
          opacity: 0.03;
          position: absolute;
          right: 3%;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          animation: bolt 4s ease-in-out infinite;
          user-select: none;
        }

        /* ── Service cards ── */
        .services-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: #1a1a1a;
          border: 1px solid #1a1a1a;
          border-radius: 12px;
          overflow: hidden;
        }

        .service-card {
          background: #0f0f0f;
          padding: 28px 24px;
          position: relative;
          overflow: hidden;
          transition: background 0.2s;
          cursor: default;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .service-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #F4C30008 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .service-card:hover { background: #141414; }
        .service-card:hover::after { opacity: 1; }
        .service-card:hover .service-icon { transform: scale(1.1); color: #F4C300; }
        .service-card:hover .service-bar { transform: scaleX(1); }

        .service-bar {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: #F4C300;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s ease;
        }

        .service-icon {
          font-size: 28px;
          line-height: 1;
          transition: transform 0.2s, color 0.2s;
          display: block;
          margin-bottom: 4px;
        }

        .service-name {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 18px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #fff;
          line-height: 1.1;
        }

        .service-desc {
          font-size: 12px;
          color: #555;
          line-height: 1.5;
          flex: 1;
        }

        .service-price {
          font-size: 13px;
          color: #F4C300;
          font-weight: 600;
          font-family: 'Barlow Condensed', sans-serif;
          letter-spacing: 0.05em;
        }

        .service-arrow {
          position: absolute;
          bottom: 20px;
          right: 20px;
          color: #F4C300;
          opacity: 0;
          transition: opacity 0.2s, transform 0.2s;
          font-size: 18px;
        }
        .service-card:hover .service-arrow { opacity: 1; transform: translate(2px, -2px); }

        /* Nav */
        .nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          padding: 0 40px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(10,10,10,0.95);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #1a1a1a;
        }
        .nav-logo {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #fff;
        }
        .nav-logo span { color: #F4C300; }
        .nav-links { display: flex; align-items: center; gap: 24px; }
        .nav-link { color: #666; font-size: 13px; text-decoration: none; transition: color 0.15s; font-weight: 500; }
        .nav-link:hover { color: #fff; }
        .nav-book {
          padding: 8px 20px;
          background: #F4C300;
          color: #000;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          border: none;
          cursor: pointer;
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .nav-book:hover { opacity: 0.88; }

        /* Why us section */
        .why-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: #1a1a1a;
          border: 1px solid #1a1a1a;
          border-radius: 12px;
          overflow: hidden;
        }
        .why-card {
          background: #0f0f0f;
          padding: 32px 28px;
        }
        .why-num {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 64px;
          font-weight: 900;
          color: #F4C300;
          line-height: 1;
          margin-bottom: 8px;
          opacity: 0.9;
        }
        .why-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 20px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }
        .why-desc { font-size: 13px; color: #555; line-height: 1.6; }

        /* CTA banner */
        .cta-banner {
          background: #F4C300;
          padding: 60px 40px;
          text-align: center;
        }

        @media (max-width: 900px) {
          .services-grid { grid-template-columns: repeat(2, 1fr); }
          .why-grid { grid-template-columns: 1fr; }
          .nav-links .nav-link { display: none; }
        }
        @media (max-width: 500px) {
          .services-grid { grid-template-columns: 1fr; }
          .nav { padding: 0 20px; }
          .bolt-deco { display: none; }
        }
      `}</style>

      {/* Nav */}
      <nav className="nav">
        <div className="nav-logo">BigBoss<span>Electric</span></div>
        <div className="nav-links">
          <a href="#services" className="nav-link">Services</a>
          <a href="#why" className="nav-link">Why us</a>
          <a href="tel:5554262622" className="nav-link">(555) 426-2622</a>
          <a href="/book" className="nav-book">Book now</a>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', paddingTop: '60px' }}>
        <div className="grid-bg" />
        <div className="bolt-deco">⚡</div>

        <div style={{ padding: '0 40px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
          <div style={{ marginBottom: '16px', animation: 'slide-up 0.6s ease both' }}>
            <span style={{ fontFamily: 'Barlow Condensed', fontSize: 'clamp(13px, 2vw, 16px)', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#F4C300' }}>
              Licensed · Bonded · Insured
            </span>
          </div>

          <h1 className="hero-title">
            Big<span style={{ color: '#F4C300' }}>Boss</span><br />
            Electric
          </h1>

          <div style={{ position: 'relative', display: 'inline-block', marginTop: '12px', marginBottom: '36px' }}>
            <p style={{ fontFamily: 'Barlow Condensed', fontSize: 'clamp(18px, 3.5vw, 32px)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#444', animation: 'slide-up 0.8s ease 0.15s both' }}>
              Everything is no problem.
            </p>
            <span className="spark" />
            <span className="spark" />
            <span className="spark" />
            <span className="spark" />
            <span className="spark" />
            <span className="spark" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', animation: 'slide-up 0.8s ease 0.3s both' }}>
            <a href="/book" className="book-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#000"/>
              </svg>
              Book a service
            </a>
            <a href="tel:5554262622" style={{ color: '#444', fontSize: '14px', textDecoration: 'none', letterSpacing: '0.05em', transition: 'color 0.15s', animation: 'slide-up 0.8s ease 0.4s both' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F4C300')}
              onMouseLeave={e => (e.currentTarget.style.color = '#444')}>
              (555) 426-2622
            </a>
          </div>

          {/* Scroll indicator */}
          <div style={{ position: 'absolute', bottom: '40px', left: '40px', display: 'flex', alignItems: 'center', gap: '8px', animation: 'fade-in 1s ease 1s both' }}>
            <div style={{ width: '1px', height: '40px', background: 'linear-gradient(to bottom, transparent, #333)' }} />
            <span style={{ fontSize: '10px', color: '#333', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 500 }}>Scroll</span>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: '#F4C300', padding: '32px 40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', textAlign: 'center' }}>
          {[
            { num: '24/7', label: 'Emergency service' },
            { num: '500+', label: 'Jobs completed' },
            { num: '5★',   label: 'Average rating' },
            { num: '10yr', label: 'In business' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900, color: '#000', lineHeight: 1 }}>{s.num}</div>
              <div style={{ fontSize: '11px', color: '#333', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Services */}
      <div id="services" style={{ background: '#0a0a0a', padding: '80px 40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#F4C300', marginBottom: '8px' }}>
                What we do
              </div>
              <h2 style={{ fontFamily: 'Barlow Condensed', fontSize: 'clamp(40px, 7vw, 72px)', fontWeight: 900, textTransform: 'uppercase', lineHeight: 0.9, letterSpacing: '-0.01em' }}>
                Our<br />Services
              </h2>
            </div>
            <a href="/book" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', border: '1.5px solid #2a2a2a', borderRadius: '4px', color: '#888', fontSize: '13px', fontWeight: 500, textDecoration: 'none', transition: 'border-color 0.15s, color 0.15s', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#F4C300'; e.currentTarget.style.color = '#F4C300' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#888' }}>
              View all services →
            </a>
          </div>

          <div className="services-grid">
            {services.map((sv, i) => (
              <a href="/book" key={sv.id} className="service-card" style={{ textDecoration: 'none' }}>
                <div className="service-bar" />
                <span className="service-icon">{SERVICE_ICONS[sv.name] ?? '⚡'}</span>
                <div className="service-name">{sv.name}</div>
                <div className="service-desc">{sv.description}</div>
                <div className="service-price">{formatPrice(sv.price_cents)}</div>
                <span className="service-arrow">↗</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Why us */}
      <div id="why" style={{ background: '#050505', padding: '80px 40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ marginBottom: '40px' }}>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#F4C300', marginBottom: '8px' }}>
              Why choose us
            </div>
            <h2 style={{ fontFamily: 'Barlow Condensed', fontSize: 'clamp(40px, 7vw, 72px)', fontWeight: 900, textTransform: 'uppercase', lineHeight: 0.9 }}>
              The BigBoss<br />Difference
            </h2>
          </div>

          <div className="why-grid">
            {[
              { num: '01', title: 'Same-day service', desc: 'Most jobs booked before noon are completed the same day. We show up when we say we will — every time.' },
              { num: '02', title: 'Upfront pricing', desc: 'No surprises. We give you a firm quote before any work begins. What we quote is what you pay.' },
              { num: '03', title: 'Fully licensed', desc: 'All work is performed by licensed master electricians and comes with a written warranty on parts and labor.' },
            ].map(w => (
              <div key={w.num} className="why-card">
                <div className="why-num">{w.num}</div>
                <div className="why-title">{w.title}</div>
                <div className="why-desc">{w.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="cta-banner">
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed', fontSize: 'clamp(40px, 8vw, 80px)', fontWeight: 900, textTransform: 'uppercase', color: '#000', lineHeight: 0.9, marginBottom: '20px' }}>
            Ready to get started?
          </h2>
          <p style={{ fontSize: '16px', color: '#333', marginBottom: '28px', lineHeight: 1.6 }}>
            Book online in 60 seconds or call us directly. Everything is no problem.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/book" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 32px', background: '#000', color: '#F4C300', fontFamily: 'Barlow Condensed', fontSize: '18px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', textDecoration: 'none', transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              ⚡ Book now
            </a>
            <a href="tel:5554262622" style={{ display: 'inline-flex', alignItems: 'center', padding: '14px 32px', background: 'transparent', color: '#000', border: '2px solid #000', fontFamily: 'Barlow Condensed', fontSize: '18px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', textDecoration: 'none' }}>
              (555) 426-2622
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#050505', borderTop: '1px solid #1a1a1a', padding: '24px 40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: '18px', fontWeight: 900, textTransform: 'uppercase' }}>
            BigBoss<span style={{ color: '#F4C300' }}>Electric</span>
          </div>
          <div style={{ fontSize: '12px', color: '#333' }}>
            Everything is no problem. · Licensed, Bonded & Insured
          </div>
        </div>
      </div>
    </>
  )
}
