'use client'

// app/contact/[slug]/page.tsx
// Public contact / inquiry form.
// Submits to /api/inbox/inquiry (server-side validation).

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Step = 'form' | 'done'

export default function ContactPage() {
  const params = useParams()
  const slug = params?.slug as string | undefined

  const [tenant, setTenant]           = useState<any>(null)
  const [tenantLoading, setTenantLoading] = useState(true)
  const [step, setStep]               = useState<Step>('form')
  const [form, setForm]               = useState({ first_name:'', last_name:'', phone:'', email:'', message:'' })
  const [errors, setErrors]           = useState<any>({})
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState<string|null>(null)

  useEffect(() => {
    if (!slug) return
    supabase
      .from('tenants')
      .select('id,name')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()
      .then(({ data }) => {
        if (data) setTenant(data)
        setTenantLoading(false)
      })
  }, [slug])

  function validate() {
    const e: any = {}
    if (!form.first_name.trim()) e.first_name = 'Required'
    if (!form.last_name.trim())  e.last_name  = 'Required'
    if (!form.phone.trim())      e.phone      = 'Required'
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Valid email required'
    if (!form.message.trim() || form.message.trim().length < 5) e.message = 'Please include a message (at least 5 characters)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (!validate() || !slug) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch('/api/inbox/inquiry', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          first_name: form.first_name,
          last_name:  form.last_name,
          phone:      form.phone,
          email:      form.email,
          message:    form.message,
        }),
      })

      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        setSubmitError(payload?.error || 'Could not send message')
        setSubmitting(false)
        return
      }

      setSubmitting(false)
      setStep('done')
    } catch {
      setSubmitError('Network error — please try again')
      setSubmitting(false)
    }
  }

  if (tenantLoading) return <div style={{color:'white',padding:40}}>Loading...</div>
  if (!tenant) return <div style={{color:'red',padding:40}}>Business not found</div>

  const Y  = '#F4C300'
  const BG = '#0d0d0d'
  const CARD = '#1a1a1a'
  const BORDER = '#2a2a2a'

  const page:   any = { minHeight:'100vh', background:BG, color:'#fff', fontFamily:'sans-serif' }
  const header: any = { background:'#111', borderBottom:`3px solid ${Y}`, padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }
  const wrap:   any = { maxWidth:'560px', margin:'0 auto', padding:'28px 20px' }
  const btnS:   any = { padding:'12px 24px', background:Y, color:'#000', border:'none', borderRadius:'6px', fontSize:'14px', fontWeight:700, cursor:'pointer', width:'100%', marginTop:'16px', fontFamily:'sans-serif' }
  const inp:    any = { width:'100%', padding:'9px 12px', background:'#111', border:`1px solid ${BORDER}`, borderRadius:'6px', color:'#fff', fontSize:'14px', fontFamily:'sans-serif', boxSizing:'border-box', outline:'none' }
  const lbl:    any = { fontSize:'11px', fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'5px' }
  const errS:   any = { fontSize:'11px', color:Y, marginTop:'3px' }

  if (step === 'done') return (
    <div style={page}>
      <div style={header}>
        <span style={{ fontFamily:'Georgia,serif', fontSize:'20px', color:Y, fontStyle:'italic' }}>{tenant.name}</span>
        <span style={{ fontSize:'12px', color:'#888' }}>Contact</span>
      </div>
      <div style={{ ...wrap, textAlign:'center' }}>
        <div style={{ width:'64px', height:'64px', background:Y, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'20px auto' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 style={{ fontFamily:'Georgia,serif', fontSize:'24px', color:Y, fontStyle:'italic', marginBottom:'10px' }}>
          Message sent!
        </h2>
        <p style={{ color:'#888', fontSize:'14px', lineHeight:1.7, marginBottom:'20px' }}>
          Thanks {form.first_name} — the {tenant.name} team will get back to you shortly.
        </p>
        <a href={`/book/${slug}`}
          style={{ display:'inline-block', padding:'10px 24px', background:'transparent', border:`1px solid ${BORDER}`, borderRadius:'6px', color:'#888', fontSize:'13px', textDecoration:'none', transition:'border-color 0.15s' }}>
          Book a service instead →
        </a>
      </div>
    </div>
  )

  return (
    <div style={page}>
      <div style={header}>
        <span style={{ fontFamily:'Georgia,serif', fontSize:'20px', color:Y, fontStyle:'italic' }}>{tenant.name}</span>
        <span style={{ fontSize:'12px', color:'#888' }}>Contact</span>
      </div>
      <div style={wrap}>
        <h2 style={{ fontFamily:'Georgia,serif', fontSize:'20px', marginBottom:'8px', color:Y, fontStyle:'italic' }}>
          Get in touch
        </h2>
        <p style={{ fontSize:'13px', color:'#888', marginBottom:'20px' }}>
          Have a question or need a quote? Send us a message and we'll get back to you.
        </p>

        <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:'8px', overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontFamily:'Georgia,serif', fontSize:'16px', fontStyle:'italic' }}>Your details</span>
          </div>
          <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label style={lbl}>First name</label>
                <input style={inp} value={form.first_name} onChange={e => setForm(f => ({...f, first_name:e.target.value}))} />
                {errors.first_name && <div style={errS}>{errors.first_name}</div>}
              </div>
              <div>
                <label style={lbl}>Last name</label>
                <input style={inp} value={form.last_name} onChange={e => setForm(f => ({...f, last_name:e.target.value}))} />
                {errors.last_name && <div style={errS}>{errors.last_name}</div>}
              </div>
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <input style={inp} type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone:e.target.value}))} placeholder="(555) 000-0000" />
              {errors.phone && <div style={errS}>{errors.phone}</div>}
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({...f, email:e.target.value}))} placeholder="you@email.com" />
              {errors.email && <div style={errS}>{errors.email}</div>}
            </div>
            <div>
              <label style={lbl}>Message</label>
              <textarea
                style={{ ...inp, minHeight:'100px', resize:'vertical' }}
                value={form.message}
                onChange={e => setForm(f => ({...f, message:e.target.value}))}
                placeholder="Tell us what you need — describe the job, ask a question, or request a quote."
              />
              {errors.message && <div style={errS}>{errors.message}</div>}
            </div>

            {submitError && (
              <div style={{ background:'#2a0a0a', border:'1px solid #8c2820', borderRadius:'6px', padding:'10px 12px', fontSize:'12px', color:'#f4a0a0' }}>
                {submitError}
              </div>
            )}

            <button style={{ ...btnS, opacity:submitting?0.6:1 }} disabled={submitting} onClick={submit}>
              {submitting ? 'Sending...' : 'Send message'}
            </button>
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:'20px' }}>
          <a href={`/book/${slug}`} style={{ fontSize:'13px', color:'#888', textDecoration:'none' }}>
            Want to book a service instead? →
          </a>
        </div>
      </div>
    </div>
  )
}
