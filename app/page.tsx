'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TENANT_ID = '11111111-1111-1111-1111-111111111111'

export default function LandingPage() {
  const [services, setServices] = useState<any[]>([])

  useEffect(() => {
    supabase
      .from('services')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('display_order')
      .limit(6)
      .then(({ data }) => setServices(data ?? []))
  }, [])

  function formatPrice(cents: number | null) {
    if (!cents) return 'Get a quote'
    return '$' + (cents / 100).toFixed(0)
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        
        body { background: #0a0a0a; color: #fff; font-family: 'DM Sans', sans-serif; }

        @keyframes spark-1 {
          0%   { transform: translate(0,0) scale(1);   opacity: 1; }
          100% { transform: translate(-40px,-80px) scale(0); opacity: 0; }
        }
        @keyframes spark-2 {
          0%   { transform: translate(0,0) scale(1);   opacity: 1; }
          100% { transform: translate(30px,-90px) scale(0);  opacity: 0; }
        }
        @keyframes spark-3 {
          0%   { transform: translate(0,0) scale(1);   opacity: 1; }
          100% { transform: translate(-20px,-70px) scale(0); opacity: 0; }
        }
        @keyframes spark-4 {
          0%   { transform: translate(0,0) scale(1);   opacity: 1; }
          100% { transform: translate(50px,-60px) scale(0);  opacity: 0; }
        }
        @keyframes pulse-glow {
          0%,100% { box-shadow: 0 0 20px #F4C30044; }
          50%     { box-shadow: 0 0 40px #F4C30088; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bolt {
          0%,90%,100% { opacity: 0; }
          92%          { opacity: 1; }
          94%          { opacity: 0.4; }
          96%          { opacity: 1; }
        }

        .spark-wrap { position: relative; display: inline-block; }
        .spark {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #F4C300;
          pointer-events: none;
        }
        .spark:nth-child(1) { bottom: 10px; left: 20px;  animation: spark-1 1.4s ease-out infinite; }
        .spark:nth-child(2) { bottom: 15px; left: 40px;  animation: spark-2 1.8s ease-out infinite 0.3s; }
        .spark:nth-child(3) { bottom: 8px;  left: 60px;  animation: spark-3 1.2s ease-out infinite 0.6s; }
        .spark:nth-child(4) { bottom: 12px; left: 80px;  animation: spark-4 1.6s ease-out infinite 0.9s; }
        .spark:nth-child(5) { bottom: 6px;  left: 100px; animation: spark-1 1.3s ease-out infinite 0.2s; }
        .spark:nth-child(6) { bottom: 14px; left: 120px; animation: spark-2 1.7s ease-out infinite 0.7s; }

        .hero-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: clamp(56px, 10vw, 110px);
          font-weight: 800;
          line-height: 0.9;
          text-transform: uppercase;
          letter-spacing: -0.02em;
          animation: slide-up 0.8s ease both;
        }

        .yellow { color: #F4C300; }

        .tagline {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: clamp(18px, 3vw, 26px);
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #F4C300;
          animation: slide-up 0.8s ease 0.2s both;
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

        .phone-link {
          color: #888;
          font-size: 14px;
          text-decoration: none;
          letter-spacing: 0.05em;
          animation: slide-up 0.8s ease 0.5s both;
          transition: color 0.15s;
        }
        .phone-link:hover { color: #F4C300; }

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
          font-size: 180px;
          line-height: 1;
          color: #F4C300;
          opacity: 0.04;
          position: absolute;
          right: 5%;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          animation: bolt 4s ease-in-out infinite;
          user-select: none;
        }

        .service-card {
          background: #111;
          border: 1px solid #222;
          padding: 24px;
          position: relative;
          overflow: hidden;
          transition: border-color 0.2s, transform 0.2s;
          cursor: default;
        }
        .service-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: #F4C300;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s;
        }
        .service-card:hover { border-color: #F4C300; transform: translateY(-2px); }
        .service-card:hover::before { transform: scaleX(1); }

        .service-name {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }
        .service-desc { font-size: 13px; color: #666; line-height: 1.5; margin-bottom: 12px; }
        .service-price { font-size: 13px; color: #F4C300; font-weight: 600; }

        .nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          padding: 16px 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(10,10,10,0.9);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid #1a1a1a;
        }
        .nav-logo {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #fff;
        }
        .nav-logo span { color: #F4C300; }
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

        section { padding: 80px 40px; max-width: 1100px; margin: 0 auto; }

        @media (max-width: 600px) {
          .nav { padding: 14px 20px; }
          section { padding: 60px 20px; }
          .bolt-deco { display: none; }
        }
      `}</style>

      <nav className="nav">
        <div className="nav-logo">BigBoss<span>Electric</span></div>
        <a href="/book" className="nav-book">Book now</a>
      </nav>

      <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', paddingTop: '80px' }}>
        <div className="grid-bg" />
        <div className="bolt-deco">⚡</div>

        <section style={{ padding: '0 40px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
          <div style={{ marginBottom: '16px' }}>
            <span className="tagline">Licensed · Bonded · Insured</span>
          </div>

          <h1 className="hero-title">
            Big<span className="yellow">Boss</span><br />
            Electric
          </h1>

          <div className="spark-wrap" style={{ display: 'block', marginTop: '8px', marginBottom: '32px' }}>
            <p style={{ fontFamily: 'Barlow Condensed', fontSize: 'clamp(20px, 4vw, 36px)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', animation: 'slide-up 0.8s ease 0.1s both' }}>
              Everything is no problem.
            </p>
            <span className="spark" />
            <span className="spark" />
            <span className="spark" />
            <span className="spark" />
            <span className="spark" />
            <span className="spark" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <a href="/book" className="book-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#000"/>
              </svg>
              Book a service
            </a>
            <a href="tel:5554262622" className="phone-link">(555) 426-2622</a>
          </div>
        </section>
      </div>

      <div style={{ background: '#F4C300', padding: '40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', textAlign: 'center' }}>
          {[
            { num: '24/7', label: 'Emergency service' },
            { num: '500+', label: 'Jobs completed' },
            { num: '5★',   label: 'Average rating' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: '48px', fontWeight: 800, color: '#000', lineHeight: 1 }}>{s.num}</div>
              <div style={{ fontSize: '12px', color: '#333', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#0a0a0a', padding: '80px 40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ marginBottom: '40px' }}>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#F4C300', marginBottom: '8px' }}>
              What we do
            </div>
            <h2 style={{ fontFamily: 'Barlow Condensed', fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, textTransform: 'uppercase', lineHeight: 0.95 }}>
              Our Services
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {services.map(sv => (
              <div key={sv.id} className="service-card">
                <div className="service-name">{sv.name}</div>
                <div className="service-desc">{sv.description}</div>
                <div className="service-price">{formatPrice(sv.price_cents)}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '40px', textAlign: 'center' }}>
            <a href="/book" className="book-btn" style={{ display: 'inline-flex', textDecoration: 'none' }}>
              Book any service →
            </a>
          </div>
        </div>
      </div>

      <div style={{ background: '#050505', borderTop: '1px solid #1a1a1a', padding: '32px 40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: '18px', fontWeight: 800, textTransform: 'uppercase' }}>
            BigBoss<span style={{ color: '#F4C300' }}>Electric</span>
          </div>
          <div style={{ fontSize: '13px', color: '#555' }}>
            Everything is no problem. · <a href="tel:5554262622" style={{ color: '#666', textDecoration: 'none' }}>(555) 426-2622</a>
          </div>
        </div>
      </div>
    </>
  )
}
