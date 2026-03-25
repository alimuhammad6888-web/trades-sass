'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f6f1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif'
    }}>
      <div style={{
        background: '#fff', border: '1px solid #e8e4dc',
        borderRadius: '8px', padding: '40px', width: '100%', maxWidth: '400px'
      }}>
        <h1 style={{ fontSize: '24px', marginBottom: '8px', color: '#1a1917' }}>
          Sign in
        </h1>
        <p style={{ fontSize: '14px', color: '#9a9590', marginBottom: '28px' }}>
          TradesSaaS dashboard
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#4a4843', display: 'block', marginBottom: '6px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%', padding: '9px 12px', border: '1px solid #e8e4dc',
                borderRadius: '6px', fontSize: '14px', fontFamily: 'sans-serif',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#4a4843', display: 'block', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '9px 12px', border: '1px solid #e8e4dc',
                borderRadius: '6px', fontSize: '14px', fontFamily: 'sans-serif',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: '13px', color: '#b0322a', background: '#fdf0ef', padding: '10px 12px', borderRadius: '6px' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px', background: '#1a1917', color: '#fff',
              border: 'none', borderRadius: '6px', fontSize: '14px',
              fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, fontFamily: 'sans-serif'
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p style={{ fontSize: '12px', color: '#9a9590', marginTop: '20px', textAlign: 'center' }}>
          Demo: owner@demo.com / Demo1234!
        </p>
      </div>
    </div>
  )
}
