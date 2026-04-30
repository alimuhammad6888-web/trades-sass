'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useTenant } from '@/lib/tenant-context'
import { useThemeTokens } from '@/lib/theme'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_STYLES: any = {
  pending:   { bg:'#fef4e0', color:'#9a5c10' },
  confirmed: { bg:'#e8f5ee', color:'#1a6b4a' },
  completed: { bg:'#eef4fb', color:'#1e4d8c' },
  cancelled: { bg:'#fdf0ef', color:'#8c2820' },
}

function BookingsInner() {
  const { tenant } = useTenant()
  const T = useThemeTokens()
  const searchParams = useSearchParams()
  const [bookings, setBookings] = useState<any[]>([])
  const [fetched, setFetched]   = useState(false)
  const [filter, setFilter]     = useState('all')
  const [updating, setUpdating] = useState<string|null>(null)
  const [toast, setToast]       = useState<{msg:string; ok:boolean}|null>(null)

  useEffect(() => {
    const confirm = searchParams.get('confirm')
    if (confirm === 'success')   { showToast('✓ Booking confirmed!', true);  setFilter('confirmed') }
    if (confirm === 'already')   { showToast('This booking was already confirmed.', true) }
    if (confirm === 'invalid')   { showToast('Invalid confirmation link.', false) }
    if (confirm === 'notfound')  { showToast('Booking not found.', false) }
    if (confirm === 'cancelled') { showToast('This booking has been cancelled.', false) }
  }, [searchParams])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    if (!tenant?.id) return
    loadBookings()
  }, [tenant?.id])

  async function loadBookings() {
    const { data } = await supabase
      .from('bookings')
      .select(`id, status, starts_at, ends_at, price_cents, notes, customers(first_name,last_name,phone,email), services(name)`)
      .eq('tenant_id', tenant!.id)
      .order('starts_at', { ascending:false })
    setBookings(data ?? [])
    setFetched(true)
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setUpdating(null)
      showToast('Session expired — please log in again.', false)
      return
    }

    const res = await fetch('/api/bookings/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        bookingId: id,
        status,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setUpdating(null)
      showToast(data?.error ?? 'Failed to update booking.', false)
      return
    }

    await loadBookings()
    setUpdating(null)
    if (status === 'confirmed') showToast('✓ Booking confirmed!', true)
  }

  function fmt(iso: string)     { return new Date(iso).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) }
  function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) }
  function fmtPrice(c: number|null) { return c ? '$'+(c/100).toFixed(0) : 'Quote' }

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter)
  const pending  = bookings.filter(b => b.status === 'pending')

  return (
    <div style={{ minHeight:'100vh', background:T.bg, fontFamily:'sans-serif', transition:'background 0.2s' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:'16px', right:'16px', zIndex:200, background:toast.ok?'#1a6b4a':'#8c2820', color:'#fff', padding:'12px 20px', borderRadius:'8px', fontSize:'13px', fontWeight:500, boxShadow:'0 4px 12px rgba(0,0,0,0.2)', animation:'slideDown 0.2s ease' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ padding:'20px 20px 0' }}>
        <h1 style={{ fontFamily:'Georgia,serif', fontSize:'22px', fontStyle:'italic', color:T.t1, marginBottom:'4px' }}>Bookings</h1>
        <p style={{ fontSize:'13px', color:T.t3, marginBottom:'16px' }}>Manage and update appointment status</p>

        {/* Pending alert */}
        {fetched && pending.length > 0 && (
          <div style={{ background:T.isDark?'#2a1a00':'#fef4e0', border:`1px solid ${T.isDark?'#5a3a00':'#f0c060'}`, borderRadius:'8px', padding:'14px 16px', marginBottom:'16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', animation:'slideDown 0.3s ease' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#E07B2A', animation:'pulse 1.5s ease infinite', flexShrink:0 }} />
              <div>
                <div style={{ fontSize:'14px', fontWeight:600, color:T.isDark?'#F4C300':'#9a5c10' }}>
                  {pending.length} booking{pending.length > 1 ? 's' : ''} waiting for confirmation
                </div>
                <div style={{ fontSize:'12px', color:T.isDark?'#a08030':'#c88020', marginTop:'2px' }}>
                  Confirm via email link, SMS reply, or click below
                </div>
              </div>
            </div>
            <button onClick={() => setFilter('pending')}
              style={{ padding:'6px 14px', background:'#E07B2A', color:'#fff', border:'none', borderRadius:'6px', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'sans-serif' }}>
              View pending
            </button>
          </div>
        )}

        {/* Filters */}
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {['all','pending','confirmed','completed','cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'6px 14px', borderRadius:'20px', border:`1px solid ${filter===f?T.t1:T.border}`, fontSize:'12px', fontWeight:500, cursor:'pointer', fontFamily:'sans-serif', background:filter===f?T.t1:T.card, color:filter===f?(T.isDark?'#000':'#fff'):T.t2, transition:'all 0.15s' }}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
              {f !== 'all' && <span style={{ marginLeft:'6px', fontSize:'11px', opacity:0.6 }}>{bookings.filter(b=>b.status===f).length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:'16px 20px 28px' }}>
        {!fetched ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {[1,2,3].map(i => <div key={i} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px', height:'90px', animation:'pulse 1.5s ease infinite' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px', color:T.t3, background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px' }}>
            No {filter === 'all' ? '' : filter} bookings yet
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {filtered.map(b => {
              const sc = STATUS_STYLES[b.status] ?? STATUS_STYLES.pending
              const isPending = b.status === 'pending'
              return (
                <div key={b.id} style={{ background:T.card, border:`1px solid ${isPending?'#E07B2A55':T.border}`, borderRadius:'8px', padding:'16px 20px', transition:'background 0.2s', position:'relative' }}>
                  {isPending && <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'#E07B2A', borderRadius:'8px 8px 0 0' }} />}
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:'200px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'15px', fontWeight:600, color:T.t1 }}>{b.customers?.first_name} {b.customers?.last_name}</span>
                        <span style={{ padding:'2px 8px', borderRadius:'20px', fontSize:'11px', fontWeight:500, background:sc.bg, color:sc.color }}>{b.status}</span>
                      </div>
                      <div style={{ fontSize:'13px', color:T.t2, marginBottom:'2px' }}>{b.services?.name} · {fmtPrice(b.price_cents)}</div>
                      <div style={{ fontSize:'12px', color:T.t3, fontFamily:'monospace' }}>{fmt(b.starts_at)} at {fmtTime(b.starts_at)}</div>
                      {b.customers?.phone && <div style={{ fontSize:'12px', color:T.t3, marginTop:'4px' }}>📞 {b.customers.phone}{b.customers?.email?` · ${b.customers.email}`:''}</div>}
                      {b.notes && <div style={{ fontSize:'12px', color:T.t3, marginTop:'6px', fontStyle:'italic' }}>Note: {b.notes}</div>}
                    </div>
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'flex-start' }}>
                      {isPending && (
                        <button onClick={() => updateStatus(b.id,'confirmed')} disabled={updating===b.id}
                          style={{ padding:'7px 16px', background:'#1a6b4a', color:'#fff', border:'none', borderRadius:'6px', fontSize:'13px', fontWeight:600, cursor:'pointer', opacity:updating===b.id?0.5:1, fontFamily:'sans-serif' }}>
                          {updating===b.id?'...':'✓ Confirm'}
                        </button>
                      )}
                      {b.status==='confirmed' && <button onClick={()=>updateStatus(b.id,'completed')} disabled={updating===b.id} style={{ padding:'6px 14px', background:'#1e4d8c', color:'#fff', border:'none', borderRadius:'6px', fontSize:'12px', fontWeight:500, cursor:'pointer', opacity:updating===b.id?0.5:1, fontFamily:'sans-serif' }}>Mark complete</button>}
                      {b.status==='completed' && <button onClick={()=>updateStatus(b.id,'confirmed')} disabled={updating===b.id} style={{ padding:'6px 14px', background:'transparent', color:'#1e4d8c', border:'1px solid #1e4d8c', borderRadius:'6px', fontSize:'12px', fontWeight:500, cursor:'pointer', opacity:updating===b.id?0.5:1, fontFamily:'sans-serif' }}>Reopen</button>}
                      {b.status==='cancelled' && <button onClick={()=>updateStatus(b.id,'pending')} disabled={updating===b.id} style={{ padding:'6px 14px', background:'transparent', color:'#9a5c10', border:'1px solid #9a5c10', borderRadius:'6px', fontSize:'12px', fontWeight:500, cursor:'pointer', opacity:updating===b.id?0.5:1, fontFamily:'sans-serif' }}>Restore</button>}
                      {!['cancelled','completed','no_show'].includes(b.status) && <button onClick={()=>updateStatus(b.id,'cancelled')} disabled={updating===b.id} style={{ padding:'6px 14px', background:'transparent', color:'#8c2820', border:'1px solid #8c2820', borderRadius:'6px', fontSize:'12px', fontWeight:500, cursor:'pointer', opacity:updating===b.id?0.5:1, fontFamily:'sans-serif' }}>Cancel</button>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function BookingsPage() {
  return <Suspense><BookingsInner /></Suspense>
}
