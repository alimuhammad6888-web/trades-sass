'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { adjustHex, getTenantBrandMarkCss, getTenantTheme, tenantPublicChrome } from '@/lib/tenant-theme'

interface Theme {
  tenantName: string
  logoUrl: string | null
  brand: string
  accent: string
  bg: string
  text: string
  bgSurface: string
  bgBorder: string
  textMuted: string
}

interface FormState {
  first_name: string
  last_name: string
  phone: string
  email: string
  message: string
}

const initialForm: FormState = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  message: '',
}

export default function ContactPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [theme, setTheme] = useState<Theme | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    Promise.all([
      supabase.from('tenants').select('id, name, is_active').eq('slug', slug).single(),
    ]).then(async ([{ data: tenant }]) => {
      if (!tenant || !tenant.is_active) {
        setLoading(false)
        return
      }

      const { data: settings } = await supabase
        .from('business_settings')
        .select('primary_color, accent_color, bg_color, text_color, logo_url')
        .eq('tenant_id', tenant.id)
        .maybeSingle()

      const tenantTheme = getTenantTheme(settings)

      setTheme({
        tenantName: tenant.name,
        logoUrl: settings?.logo_url ?? null,
        ...tenantTheme,
      })
      setLoading(false)
    })
  }, [slug])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/inbox/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...form }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong. Please try again.')
        return
      }

      setSuccess(true)
      setForm(initialForm)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0a0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            border: '2px solid #333',
            borderTopColor: '#F4C300',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!theme) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0a0a',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>404</div>
          <p style={{ color: '#555' }}>Business not found.</p>
        </div>
      </div>
    )
  }

  const { tenantName, logoUrl, brand, accent, bg, text, bgSurface, bgBorder, textMuted } = theme

  const inp: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${bgBorder}`,
    borderRadius: '6px',
    fontSize: '14px',
    color: text,
    background: bgSurface,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: tenantPublicChrome.fontSans,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  const lbl: React.CSSProperties = {
    display: 'block',
    marginBottom: '5px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: textMuted,
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body {
          background: ${bg};
          color: ${text};
          font-family: ${tenantPublicChrome.fontSans};
          -webkit-font-smoothing: antialiased;
        }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        .contact-input:focus {
          border-color: ${brand} !important;
          box-shadow: 0 0 0 2px ${brand}33;
        }
        .contact-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: ${tenantPublicChrome.navHeight};
          background: ${bg}f2;
          backdrop-filter: blur(12px);
          border-bottom: 1px solid ${bgBorder};
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: ${tenantPublicChrome.navPadding};
          z-index: 100;
        }
        ${getTenantBrandMarkCss('.contact-nav-logo', text)}
        .contact-nav-logo { text-decoration: none; }
        .contact-nav-book {
          padding: ${tenantPublicChrome.navButtonPadding};
          background: ${brand};
          color: ${bg};
          font-family: ${tenantPublicChrome.fontDisplay};
          font-size: ${tenantPublicChrome.navButtonFontSize};
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: ${tenantPublicChrome.navButtonLetterSpacing};
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .contact-nav-book:hover { opacity: 0.88; }
        .contact-submit {
          width: 100%;
          padding: 12px 24px;
          background: ${brand};
          color: ${bg};
          border: none;
          border-radius: 6px;
          font-family: ${tenantPublicChrome.fontDisplay};
          font-size: 17px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .contact-submit:hover:not(:disabled) { opacity: 0.88; }
        .contact-submit:disabled { opacity: 0.45; cursor: not-allowed; }
        .book-link {
          font-size: 13px;
          color: ${accent};
          text-decoration: none;
          font-weight: 500;
          transition: opacity 0.15s;
        }
        .book-link:hover { opacity: 0.75; }
        @media (max-width: 500px) {
          .contact-nav { padding: ${tenantPublicChrome.navPaddingMobile}; }
          .contact-form-card { padding: 24px 20px !important; }
        }
      `}</style>

      <nav className="contact-nav">
        <a href={`/t/${slug}`} className="contact-nav-logo">
          {tenantName}
        </a>
        <a href={`/book/${slug}`} className="contact-nav-book">
          Book now
        </a>
      </nav>

      <main
        style={{
          minHeight: '100vh',
          background: bg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '92px 20px 48px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '500px', animation: 'slide-up 0.5s ease both' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>

            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: accent,
                marginBottom: '6px',
              }}
            >
              CONTACT TEST 123
            </div>

            <p style={{ fontSize: '14px', color: textMuted, lineHeight: 1.6 }}>
              Fill out the form below and we'll get back to you as soon as possible.
            </p>
          </div>

          {success ? (
            <div
              style={{
                background: bgSurface,
                border: `1px solid ${bgBorder}`,
                borderRadius: '12px',
                padding: '40px 32px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: `${brand}22`,
                  border: `1.5px solid ${brand}55`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontSize: '20px',
                  color: brand,
                }}
              >
                ✓
              </div>

              <div
                style={{
                  fontFamily: tenantPublicChrome.fontDisplay,
                  fontSize: '22px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: text,
                  marginBottom: '8px',
                }}
              >
                Message sent!
              </div>

              <p style={{ fontSize: '14px', color: textMuted, lineHeight: 1.6 }}>
                We received your message and will be in touch shortly.
              </p>
            </div>
          ) : (
            <div
              className="contact-form-card"
              style={{
                background: bgSurface,
                border: `1px solid ${bgBorder}`,
                borderRadius: '12px',
                padding: '32px',
              }}
            >
              {error && (
                <div
                  style={{
                    marginBottom: '20px',
                    padding: '11px 14px',
                    background: `${adjustHex(bg, 4)}`,
                    border: `1px solid ${adjustHex(bg, 40)}`,
                    borderLeft: `3px solid #ef4444`,
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#f87171',
                  }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={lbl}>
                      First name <span style={{ color: brand }}>*</span>
                    </label>
                    <input
                      className="contact-input"
                      style={inp}
                      name="first_name"
                      type="text"
                      required
                      autoComplete="given-name"
                      value={form.first_name}
                      onChange={handleChange}
                      placeholder="Jane"
                    />
                  </div>

                  <div>
                    <label style={lbl}>
                      Last name <span style={{ color: brand }}>*</span>
                    </label>
                    <input
                      className="contact-input"
                      style={inp}
                      name="last_name"
                      type="text"
                      required
                      autoComplete="family-name"
                      value={form.last_name}
                      onChange={handleChange}
                      placeholder="Smith"
                    />
                  </div>
                </div>

                <div>
                  <label style={lbl}>
                    Phone <span style={{ color: brand }}>*</span>
                  </label>
                  <input
                    className="contact-input"
                    style={inp}
                    name="phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div>
                  <label style={lbl}>
                    Email <span style={{ color: brand }}>*</span>
                  </label>
                  <input
                    className="contact-input"
                    style={inp}
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="jane@example.com"
                  />
                </div>

                <div>
                  <label style={lbl}>
                    Message <span style={{ color: brand }}>*</span>
                  </label>
                  <textarea
                    className="contact-input"
                    style={{ ...inp, resize: 'none' }}
                    name="message"
                    required
                    rows={4}
                    value={form.message}
                    onChange={handleChange}
                    placeholder="How can we help you?"
                  />
                </div>

                <button type="submit" disabled={submitting} className="contact-submit">
                  {submitting ? 'Sending…' : 'Send message'}
                </button>
              </form>
            </div>
          )}

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <a href={`/book/${slug}`} className="book-link">
              Ready to book? →
            </a>
          </div>
        </div>
      </main>
    </>
  )
}
