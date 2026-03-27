'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f8f6f1', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif', padding:'20px' }}>
      <div style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', padding:'40px', width:'100%', maxWidth:'400px' }}>

        <a href="/dashboard/login" style={{ fontSize:'12px', color:'#9a9590', textDecoration:'none', display:'block', marginBottom:'24px' }}>← Back to sign in</a>

        {sent ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ width:'48px', height:'48px', background:'#e8f5ee', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#1a6b4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 style={{ fontFamily:'Georgia, serif', fontSize:'20px', fontStyle:'italic', color:'#1a1917', marginBottom:'8px' }}>Check your email</h2>
            <p style={{ fontSize:'14px', color:'#9a9590', lineHeight:1.6 }}>
              We sent a password reset link to <strong style={{ color:'#1a1917' }}>{email}</strong>
            </p>
            <p style={{ fontSize:'12px', color:'#c8c4bc', marginTop:'16px' }}>
              Didn't get it? Check your spam folder or{' '}
              <button onClick={() => setSent(false)} style={{ background:'none', border:'none', color:'#1a1917', cursor:'pointer', fontSize:'12px', textDecoration:'underline', padding:0 }}>
                try again
              </button>
            </p>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily:'Georgia, serif', fontSize:'22px', fontStyle:'italic', color:'#1a1917', marginBottom:'8px' }}>Reset password</h1>
            <p style={{ fontSize:'14px', color:'#9a9590', marginBottom:'28px', lineHeight:1.5 }}>
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div>
                <label style={{ fontSize:'11px', fontWeight:500, color:'#4a4843', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="owner@yourbusiness.com"
                  style={{ width:'100%', padding:'9px 12px', border:'1px solid #e8e4dc', borderRadius:'6px', fontSize:'14px', fontFamily:'sans-serif', outline:'none', boxSizing:'border-box' as any }}
                />
              </div>

              {error && (
                <p style={{ fontSize:'13px', color:'#b0322a', background:'#fdf0ef', padding:'10px 12px', borderRadius:'6px', margin:0 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                style={{ padding:'10px', background:'#1a1917', color:'#fff', border:'none', borderRadius:'6px', fontSize:'14px', fontWeight:500, cursor: loading || !email ? 'not-allowed' : 'pointer', opacity: loading || !email ? 0.5 : 1, fontFamily:'sans-serif' }}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
