'use client'

import { useEffect, useState } from 'react'
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
  no_show:   { bg:'#f5f5f5', color:'#666' },
}

export default function BookingsPage() {
  const { tenant } = useTenant()
  const T = useThemeTokens()
  const [bookings, setBookings] = useState<any[]>([])
  const [fetched, setFetched]   = useState(false)
  const [filter, setFilter]     = useState('all')
  const [updating, setUpdating] = useState<string|null>(null)

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
    await supabase.from('bookings').update({ status }).eq('id', id)
    await loadBookings()
    setUpdating(null)
  }

  function fmt(iso: string) { return new Date(iso).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) }
  function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) }
  function fmtPrice(cents: number|null) { return cents ? '$'+(cents/100).toFixed(0) : 'Quote' }

  const filtered = filter==='all' ? bookings : bookings.filter(b => b.status===filter)

  const btn = (label: string, onClick: ()=>void, variant: 'confirm'|'complete'|'danger'|'restore'|'reopen') => {
    const styles: any = {
      confirm:  { bg:'#1a6b4a', color:'#fff', border:'none' },
      complete: { bg:'#1e4d8c', color:'#fff', border:'none' },
      danger:   { bg:'transparent', color:'#8c2820', border:'1px solid #8c2820' },
      restore:  { bg:'transparent', color:'#9a5c10', border:'1px solid #9a5c10' },
      reopen:   { bg:'transparent', color:'#1e4d8c', border:'1px solid #1e4d8c' },
    }
    const s = styles[variant]
    return (
      <button onClick={onClick}
        style={{ padding:'6px 14px', background:s.bg, color:s.color, border:s.border, borderRadius:'6px', fontSize:'12px', fontWeight:500, cursor:'pointer', fontFamily:'sans-serif' }}>
        {label}
      </button>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:T.bg, fontFamily:'sans-serif', transition:'background 0.2s' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }`}</style>

      <div style={{ padding:'20px 20px 0' }}>
        <h1 style={{ fontFamily:'Georgia,serif', fontSize:'22px', fontStyle:'italic', color:T.t1, marginBottom:'4px' }}>Bookings</h1>
        <p style={{ fontSize:'13px', color:T.t3, marginBottom:'16px' }}>Manage and update appointment status</p>

        {/* Filter tabs */}
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {['all','pending','confirmed','completed','cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'6px 14px', borderRadius:'20px', border:`1px solid ${filter===f?T.t1:T.border}`, fontSize:'12px', fontWeight:500, cursor:'pointer', fontFamily:'sans-serif', background:filter===f?T.t1:T.card, color:filter===f?(T.isDark?'#000':'#fff'):T.t2, transition:'all 0.15s' }}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
              {f!=='all' && <span style={{ marginLeft:'6px', fontSize:'11px', opacity:0.6 }}>{bookings.filter(b=>b.status===f).length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:'16px 20px 28px' }}>
        {!fetched ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {[1,2,3].map(i => <div key={i} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px', height:'90px', animation:'pulse 1.5s ease infinite' }} />)}
          </div>
        ) : filtered.length===0 ? (
          <div style={{ textAlign:'center', padding:'60px', color:T.t3, background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px' }}>
            No {filter==='all'?'':filter} bookings yet
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {filtered.map(b => {
              const sc = STATUS_STYLES[b.status] ?? STATUS_STYLES.pending
              return (
                <div key={b.id} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'16px 20px', transition:'background 0.2s' }}>
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
                      {b.status==='pending'   && btn('Confirm',       () => updateStatus(b.id,'confirmed'), 'confirm')}
                      {b.status==='confirmed' && btn('Mark complete', () => updateStatus(b.id,'completed'), 'complete')}
                      {b.status==='completed' && btn('Reopen',        () => updateStatus(b.id,'confirmed'), 'reopen')}
                      {b.status==='cancelled' && btn('Restore',       () => updateStatus(b.id,'pending'),   'restore')}
                      {!['cancelled','completed','no_show'].includes(b.status) && btn('Cancel', () => updateStatus(b.id,'cancelled'), 'danger')}
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
