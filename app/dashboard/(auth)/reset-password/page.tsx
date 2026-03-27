'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [done, setDone]             = useState(false)
  const [validSession, setValidSession] = useState(false)

  useEffect(() => {
    // Supabase automatically handles the token from the URL
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true)
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }

    setLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    }
  }

  if (done) return (
    <div style={{ minHeight:'100vh', background:'#f8f6f1', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif' }}>
      <div style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', padding:'40px', width:'100%', maxWidth:'400px', textAlign:'center' }}>
        <div style={{ width:'48px', height:'48px', background:'#e8f5ee', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#1a6b4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 style={{ fontFamily:'Georgia, serif', fontSize:'20px', fontStyle:'italic', color:'#1a1917', marginBottom:'8px' }}>Password updated!</h2>
        <p style={{ fontSize:'14px', color:'#9a9590' }}>Redirecting you to the dashboard...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f8f6f1', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif', padding:'20px' }}>
      <div style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', padding:'40px', width:'100%', maxWidth:'400px' }}>

        <h1 style={{ fontFamily:'Georgia, serif', fontSize:'22px', fontStyle:'italic', color:'#1a1917', marginBottom:'8px' }}>Set new password</h1>
        <p style={{ fontSize:'14px', color:'#9a9590', marginBottom:'28px' }}>Choose a strong password for your account.</p>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div>
            <label style={{ fontSize:'11px', fontWeight:500, color:'#4a4843', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.06em' }}>
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="At least 8 characters"
              style={{ width:'100%', padding:'9px 12px', border:'1px solid #e8e4dc', borderRadius:'6px', fontSize:'14px', fontFamily:'sans-serif', outline:'none', boxSizing:'border-box' as any }}
            />
          </div>
          <div>
            <label style={{ fontSize:'11px', fontWeight:500, color:'#4a4843', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.06em' }}>
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              placeholder="Repeat your new password"
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
            disabled={loading || !password || !confirm}
            style={{ padding:'10px', background:'#1a1917', color:'#fff', border:'none', borderRadius:'6px', fontSize:'14px', fontWeight:500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || !password || !confirm ? 0.5 : 1, fontFamily:'sans-serif' }}>
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
