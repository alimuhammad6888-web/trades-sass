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
}

export default function CustomersPage() {
  const { tenant } = useTenant()
  const [customers, setCustomers] = useState<any[]>([])
  const [fetched, setFetched]     = useState(false)
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState<any>(null)
  const [bookings, setBookings]   = useState<any[]>([])
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    if (!tenant?.id) return
    supabase.from('customers').select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('created_at', { ascending:false })
      .then(({ data }) => { setCustomers(data ?? []); setFetched(true) })
  }, [tenant?.id])

  async function selectCustomer(c: any) {
    setSelected(c)
    setShowDetail(true)
    const { data } = await supabase
      .from('bookings')
      .select('id, status, starts_at, price_cents, services(name)')
      .eq('customer_id', c.id)
      .order('starts_at', { ascending:false })
    setBookings(data ?? [])
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
  }
  function fmtPrice(cents: number|null) {
    return cents ? '$'+(cents/100).toFixed(0) : 'Quote'
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    return c.first_name?.toLowerCase().includes(q) || c.last_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q)
  })

  const totalSpend = bookings.filter(b => b.status==='completed').reduce((s, b) => s+(b.price_cents??0), 0)

  const DetailPanel = () => (
    <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
      {/* Mobile back button */}
      <button onClick={() => setShowDetail(false)}
        style={{ display:'none', alignItems:'center', gap:'6px', background:'none', border:'none', color:'#9a9590', fontSize:'13px', cursor:'pointer', padding:'0', marginBottom:'16px', fontFamily:'sans-serif' }}
        className="mobile-back">
        ← All customers
      </button>

      {!selected ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#9a9590', fontSize:'14px', fontStyle:'italic', fontFamily:'Georgia, serif' }}>
          Select a customer to view details
        </div>
      ) : (
        <div style={{ maxWidth:'600px' }}>
          <div style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', padding:'20px', marginBottom:'16px' }}>
            <h2 style={{ fontFamily:'Georgia, serif', fontSize:'22px', color:'#1a1917', marginBottom:'12px', fontStyle:'italic' }}>
              {selected.first_name} {selected.last_name}
            </h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              {[
                { label:'Phone',  value:selected.phone },
                { label:'Email',  value:selected.email },
                { label:'Source', value:selected.lead_source },
                { label:'Joined', value:fmtDate(selected.created_at) },
              ].map(row => row.value && (
                <div key={row.label}>
                  <div style={{ fontSize:'10px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', color:'#9a9590', marginBottom:'2px' }}>{row.label}</div>
                  <div style={{ fontSize:'13px', color:'#1a1917' }}>{row.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'16px' }}>
            {[
              { label:'Total bookings', value:bookings.length },
              { label:'Completed',      value:bookings.filter(b=>b.status==='completed').length },
              { label:'Total spend',    value:'$'+(totalSpend/100).toFixed(0) },
            ].map(s => (
              <div key={s.label} style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', padding:'14px 16px' }}>
                <div style={{ fontSize:'10px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', color:'#9a9590', marginBottom:'6px' }}>{s.label}</div>
                <div style={{ fontFamily:'Georgia, serif', fontSize:'22px', color:'#1a1917' }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8e4dc', fontFamily:'Georgia, serif', fontSize:'14px', fontStyle:'italic', color:'#1a1917' }}>
              Booking history
            </div>
            {bookings.length === 0 ? (
              <div style={{ padding:'24px', textAlign:'center', color:'#9a9590', fontSize:'13px' }}>No bookings yet</div>
            ) : bookings.map(b => {
              const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.pending
              return (
                <div key={b.id} style={{ padding:'12px 16px', borderBottom:'1px solid #f0ede6', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px' }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:'13px', fontWeight:500, color:'#1a1917', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.services?.name}</div>
                    <div style={{ fontSize:'11px', color:'#9a9590', fontFamily:'monospace', marginTop:'2px' }}>{fmtDate(b.starts_at)}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                    <span style={{ fontSize:'12px', color:'#4a4843' }}>{fmtPrice(b.price_cents)}</span>
                    <span style={{ padding:'2px 7px', borderRadius:'20px', fontSize:'10px', fontWeight:500, background:sc.bg, color:sc.color, whiteSpace:'nowrap' }}>{b.status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
        @media (max-width: 768px) {
          .customers-layout { flex-direction: column !important; }
          .customer-list-panel { width: 100% !important; border-right: none !important; border-bottom: 1px solid #e8e4dc; }
          .customer-detail-panel { display: none !important; }
          .customer-detail-panel.mobile-show { display: flex !important; position: fixed !important; inset: 0 !important; background: #f8f6f1 !important; z-index: 10 !important; flex-direction: column !important; overflow-y: auto !important; padding-top: 52px !important; }
          .mobile-back { display: flex !important; }
        }
      `}</style>

      <div style={{ minHeight:'100vh', background:'#f8f6f1', fontFamily:'sans-serif', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'20px 20px 0', flexShrink:0 }}>
          <h1 style={{ fontFamily:'Georgia, serif', fontSize:'22px', fontStyle:'italic', color:'#1a1917', marginBottom:'4px' }}>Customers</h1>
          <p style={{ fontSize:'13px', color:'#9a9590' }}>{fetched ? `${customers.length} total` : 'Loading...'}</p>
        </div>

        <div className="customers-layout" style={{ display:'flex', flex:1, overflow:'hidden', marginTop:'16px' }}>

          {/* Left: customer list */}
          <div className="customer-list-panel" style={{ width:'300px', flexShrink:0, borderRight:'1px solid #e8e4dc', display:'flex', flexDirection:'column', background:'#fff' }}>
            <div style={{ padding:'10px', borderBottom:'1px solid #e8e4dc' }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, phone..."
                style={{ width:'100%', padding:'8px 12px', border:'1px solid #e8e4dc', borderRadius:'6px', fontSize:'13px', fontFamily:'sans-serif', outline:'none', boxSizing:'border-box' as any }} />
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
              {!fetched ? (
                [1,2,3,4,5].map(i => (
                  <div key={i} style={{ padding:'14px 16px', borderBottom:'1px solid #f0ede6' }}>
                    <div style={{ width:'120px', height:'13px', background:'#f0ede6', borderRadius:'4px', marginBottom:'6px', animation:'pulse 1.5s ease infinite' }} />
                    <div style={{ width:'80px', height:'11px', background:'#f5f2ee', borderRadius:'4px', animation:'pulse 1.5s ease infinite' }} />
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div style={{ padding:'40px', textAlign:'center', color:'#9a9590', fontSize:'13px' }}>No customers found</div>
              ) : filtered.map(c => (
                <div key={c.id} onClick={() => selectCustomer(c)}
                  style={{ padding:'13px 16px', borderBottom:'1px solid #f0ede6', cursor:'pointer', background:selected?.id===c.id?'#eef4fb':'transparent', transition:'background 0.1s' }}>
                  <div style={{ fontWeight:600, fontSize:'14px', color:'#1a1917', marginBottom:'2px' }}>{c.first_name} {c.last_name}</div>
                  <div style={{ fontSize:'12px', color:'#9a9590', marginBottom:'1px' }}>{c.phone}</div>
                  <div style={{ fontSize:'11px', color:'#c8c4bc' }}>{c.email}</div>
                  {c.lead_source && (
                    <span style={{ fontSize:'10px', padding:'1px 6px', borderRadius:'3px', background:'#f0ede6', color:'#9a9590', fontFamily:'monospace', marginTop:'4px', display:'inline-block' }}>
                      {c.lead_source}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: detail — desktop always visible, mobile full-screen */}
          <div className={`customer-detail-panel${showDetail ? ' mobile-show' : ''}`} style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }}>
            {/* Mobile back */}
            <div style={{ display:'none' }} className="mobile-back-wrap">
              <button onClick={() => setShowDetail(false)}
                style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:'none', color:'#9a9590', fontSize:'13px', cursor:'pointer', padding:'16px 20px 0', fontFamily:'sans-serif' }}>
                ← All customers
              </button>
            </div>
            <style>{`@media (max-width: 768px) { .mobile-back-wrap { display: block !important; } }`}</style>

            {!selected ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#9a9590', fontSize:'14px', fontStyle:'italic', fontFamily:'Georgia, serif' }}>
                Select a customer to view details
              </div>
            ) : (
              <div style={{ padding:'20px', maxWidth:'600px' }}>
                <div style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', padding:'20px', marginBottom:'16px' }}>
                  <h2 style={{ fontFamily:'Georgia, serif', fontSize:'22px', color:'#1a1917', marginBottom:'12px', fontStyle:'italic' }}>
                    {selected.first_name} {selected.last_name}
                  </h2>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                    {[
                      { label:'Phone',  value:selected.phone },
                      { label:'Email',  value:selected.email },
                      { label:'Source', value:selected.lead_source },
                      { label:'Joined', value:fmtDate(selected.created_at) },
                    ].map(row => row.value && (
                      <div key={row.label}>
                        <div style={{ fontSize:'10px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', color:'#9a9590', marginBottom:'2px' }}>{row.label}</div>
                        <div style={{ fontSize:'13px', color:'#1a1917' }}>{row.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'16px' }}>
                  {[
                    { label:'Bookings',  value:bookings.length },
                    { label:'Completed', value:bookings.filter(b=>b.status==='completed').length },
                    { label:'Spend',     value:'$'+(totalSpend/100).toFixed(0) },
                  ].map(s => (
                    <div key={s.label} style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', padding:'12px 14px' }}>
                      <div style={{ fontSize:'10px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', color:'#9a9590', marginBottom:'4px' }}>{s.label}</div>
                      <div style={{ fontFamily:'Georgia, serif', fontSize:'22px', color:'#1a1917' }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', overflow:'hidden' }}>
                  <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8e4dc', fontFamily:'Georgia, serif', fontSize:'14px', fontStyle:'italic', color:'#1a1917' }}>
                    Booking history
                  </div>
                  {bookings.length === 0 ? (
                    <div style={{ padding:'24px', textAlign:'center', color:'#9a9590', fontSize:'13px' }}>No bookings yet</div>
                  ) : bookings.map(b => {
                    const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.pending
                    return (
                      <div key={b.id} style={{ padding:'12px 16px', borderBottom:'1px solid #f0ede6', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px' }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:'13px', fontWeight:500, color:'#1a1917', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.services?.name}</div>
                          <div style={{ fontSize:'11px', color:'#9a9590', fontFamily:'monospace', marginTop:'2px' }}>{fmtDate(b.starts_at)}</div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                          <span style={{ fontSize:'12px', color:'#4a4843' }}>{fmtPrice(b.price_cents)}</span>
                          <span style={{ padding:'2px 7px', borderRadius:'20px', fontSize:'10px', fontWeight:500, background:sc.bg, color:sc.color, whiteSpace:'nowrap' }}>{b.status}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
