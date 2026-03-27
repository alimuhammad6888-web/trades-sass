'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useTenant } from '@/lib/tenant-context'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_COLORS: any = {
  pending:   { bg:'#fef4e0', color:'#9a5c10' },
  confirmed: { bg:'#e8f5ee', color:'#1a6b4a' },
  completed: { bg:'#eef4fb', color:'#1e4d8c' },
  cancelled: { bg:'#fdf0ef', color:'#8c2820' },
  no_show:   { bg:'#f5f5f5', color:'#666' },
}

export default function BookingsPage() {
  const { tenant } = useTenant()
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
      .select(`id, status, starts_at, ends_at, price_cents, notes, created_at, customers(first_name,last_name,phone,email), services(name,duration_mins)`)
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

  return (
    <div style={{ minHeight:'100vh', background:'#f8f6f1', fontFamily:'sans-serif' }}>
      <div style={{ padding:'24px 28px 0' }}>
        <h1 style={{ fontFamily:'Georgia, serif', fontSize:'22px', fontStyle:'italic', color:'#1a1917', marginBottom:'4px' }}>Bookings</h1>
        <p style={{ fontSize:'13px', color:'#9a9590', marginBottom:'20px' }}>Manage and update appointment status</p>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {['all','pending','confirmed','completed','cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'6px 14px', borderRadius:'20px', border:'1px solid', fontSize:'12px', fontWeight:500, cursor:'pointer', fontFamily:'sans-serif',
                background:filter===f?'#1a1917':'#fff', color:filter===f?'#fff':'#4a4843', borderColor:filter===f?'#1a1917':'#e8e4dc' }}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
              {f!=='all' && <span style={{ marginLeft:'6px', fontSize:'11px', opacity:0.7 }}>{bookings.filter(b=>b.status===f).length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:'16px 28px 28px' }}>
        {!fetched ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {[1,2,3].map(i => <div key={i} style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', height:'90px', animation:'pulse 1.5s ease infinite' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#9a9590', background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px' }}>
            No {filter==='all'?'':filter} bookings yet
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {filtered.map(b => {
              const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.pending
              return (
                <div key={b.id} style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', padding:'16px 20px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:'200px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
                        <span style={{ fontSize:'15px', fontWeight:600, color:'#1a1917' }}>{b.customers?.first_name} {b.customers?.last_name}</span>
                        <span style={{ padding:'2px 8px', borderRadius:'20px', fontSize:'11px', fontWeight:500, background:sc.bg, color:sc.color }}>{b.status}</span>
                      </div>
                      <div style={{ fontSize:'13px', color:'#4a4843', marginBottom:'2px' }}>{b.services?.name} · {fmtPrice(b.price_cents)}</div>
                      <div style={{ fontSize:'12px', color:'#9a9590', fontFamily:'monospace' }}>{fmt(b.starts_at)} at {fmtTime(b.starts_at)}</div>
                      {b.customers?.phone && <div style={{ fontSize:'12px', color:'#9a9590', marginTop:'4px' }}>📞 {b.customers.phone}{b.customers?.email?` · ${b.customers.email}`:''}</div>}
                      {b.notes && <div style={{ fontSize:'12px', color:'#9a9590', marginTop:'6px', fontStyle:'italic' }}>Note: {b.notes}</div>}
                    </div>
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'flex-start' }}>
                      {b.status==='pending' && <button onClick={()=>updateStatus(b.id,'confirmed')} disabled={updating===b.id} style={{ padding:'6px 14px', background:'#1a6b4a', color:'#fff', border:'none', borderRadius:'6px', fontSize:'12px', fontWeight:500, cursor:'pointer', opacity:updating===b.id?0.5:1 }}>Confirm</button>}
                      {b.status==='confirmed' && <button onClick={()=>updateStatus(b.id,'completed')} disabled={updating===b.id} style={{ padding:'6px 14px', background:'#1e4d8c', color:'#fff', border:'none', borderRadius:'6px', fontSize:'12px', fontWeight:500, cursor:'pointer', opacity:updating===b.id?0.5:1 }}>Mark complete</button>}
                      {b.status==='completed' && <button onClick={()=>updateStatus(b.id,'confirmed')} disabled={updating===b.id} style={{ padding:'6px 14px', background:'transparent', color:'#1e4d8c', border:'1px solid #1e4d8c', borderRadius:'6px', fontSize:'12px', fontWeight:500, cursor:'pointer', opacity:updating===b.id?0.5:1 }}>Reopen</button>}
                      {!['cancelled','completed','no_show'].includes(b.status) && <button onClick={()=>updateStatus(b.id,'cancelled')} disabled={updating===b.id} style={{ padding:'6px 14px', background:'transparent', color:'#8c2820', border:'1px solid #8c2820', borderRadius:'6px', fontSize:'12px', fontWeight:500, cursor:'pointer', opacity:updating===b.id?0.5:1 }}>Cancel</button>}
                      {b.status==='cancelled' && <button onClick={()=>updateStatus(b.id,'pending')} disabled={updating===b.id} style={{ padding:'6px 14px', background:'transparent', color:'#9a5c10', border:'1px solid #9a5c10', borderRadius:'6px', fontSize:'12px', fontWeight:500, cursor:'pointer', opacity:updating===b.id?0.5:1 }}>Restore</button>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }`}</style>
    </div>
  )
}
