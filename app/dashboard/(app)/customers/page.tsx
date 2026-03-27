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
}

export default function CustomersPage() {
  const { tenant } = useTenant()
  const T = useThemeTokens()
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
    const { data } = await supabase.from('bookings').select('id, status, starts_at, price_cents, services(name)').eq('customer_id', c.id).order('starts_at', { ascending:false })
    setBookings(data ?? [])
  }

  function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) }
  function fmtPrice(cents: number|null) { return cents ? '$'+(cents/100).toFixed(0) : 'Quote' }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    return c.first_name?.toLowerCase().includes(q) || c.last_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q)
  })

  const totalSpend = bookings.filter(b => b.status==='completed').reduce((s, b) => s+(b.price_cents??0), 0)

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
        .cust-layout { display:flex; flex:1; overflow:hidden; }
        .cust-list { width:300px; flex-shrink:0; display:flex; flex-direction:column; }
        .cust-detail { flex:1; overflow-y:auto; display:flex; flex-direction:column; }
        .mob-back { display:none !important; }
        @media (max-width:768px) {
          .cust-list { width:100% !important; border-right:none !important; }
          .cust-detail { display:none !important; }
          .cust-detail.show { display:flex !important; position:fixed !important; inset:0 !important; z-index:20 !important; overflow-y:auto !important; padding-top:52px !important; }
          .mob-back { display:flex !important; }
        }
      `}</style>

      <div style={{ minHeight:'100vh', background:T.bg, fontFamily:'sans-serif', display:'flex', flexDirection:'column', transition:'background 0.2s' }}>
        <div style={{ padding:'20px 20px 0', flexShrink:0 }}>
          <h1 style={{ fontFamily:'Georgia,serif', fontSize:'22px', fontStyle:'italic', color:T.t1, marginBottom:'4px' }}>Customers</h1>
          <p style={{ fontSize:'13px', color:T.t3 }}>{fetched?`${customers.length} total`:'Loading...'}</p>
        </div>

        <div className="cust-layout" style={{ marginTop:'16px' }}>

          {/* List */}
          <div className="cust-list" style={{ borderRight:`1px solid ${T.border}`, background:T.card, transition:'background 0.2s' }}>
            <div style={{ padding:'10px', borderBottom:`1px solid ${T.border}` }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone..."
                style={{ width:'100%', padding:'8px 12px', border:`1px solid ${T.inputBorder}`, borderRadius:'6px', fontSize:'13px', fontFamily:'sans-serif', outline:'none', boxSizing:'border-box' as any, background:T.input, color:T.t1 }} />
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
              {!fetched ? (
                [1,2,3,4,5].map(i => (
                  <div key={i} style={{ padding:'14px 16px', borderBottom:`1px solid ${T.divider}` }}>
                    <div style={{ width:'120px', height:'13px', background:T.isDark?'#222':'#f0ede6', borderRadius:'4px', marginBottom:'6px', animation:'pulse 1.5s ease infinite' }} />
                    <div style={{ width:'80px', height:'11px', background:T.isDark?'#1e1e1e':'#f5f2ee', borderRadius:'4px', animation:'pulse 1.5s ease infinite' }} />
                  </div>
                ))
              ) : filtered.length===0 ? (
                <div style={{ padding:'40px', textAlign:'center', color:T.t3, fontSize:'13px' }}>No customers found</div>
              ) : filtered.map(c => (
                <div key={c.id} onClick={() => selectCustomer(c)}
                  style={{ padding:'13px 16px', borderBottom:`1px solid ${T.divider}`, cursor:'pointer', background:selected?.id===c.id?T.hover:'transparent', transition:'background 0.1s' }}>
                  <div style={{ fontWeight:600, fontSize:'14px', color:T.t1, marginBottom:'2px' }}>{c.first_name} {c.last_name}</div>
                  <div style={{ fontSize:'12px', color:T.t3, marginBottom:'1px' }}>{c.phone}</div>
                  <div style={{ fontSize:'11px', color:T.isDark?'#444':'#c8c4bc' }}>{c.email}</div>
                  {c.lead_source && (
                    <span style={{ fontSize:'10px', padding:'1px 6px', borderRadius:'3px', background:T.isDark?'#222':T.hover, color:T.t3, fontFamily:'monospace', marginTop:'4px', display:'inline-block' }}>
                      {c.lead_source}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className={`cust-detail${showDetail?' show':''}`} style={{ background:T.bg }}>
            {/* Mobile back */}
            <button className="mob-back" onClick={() => setShowDetail(false)}
              style={{ alignItems:'center', gap:'6px', background:'none', border:'none', color:T.t3, fontSize:'13px', cursor:'pointer', padding:'16px 20px 0', fontFamily:'sans-serif' }}>
              ← All customers
            </button>

            {!selected ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:T.t3, fontSize:'14px', fontStyle:'italic', fontFamily:'Georgia,serif' }}>
                Select a customer to view details
              </div>
            ) : (
              <div style={{ padding:'20px', maxWidth:'600px' }}>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'20px', marginBottom:'16px', transition:'background 0.2s' }}>
                  <h2 style={{ fontFamily:'Georgia,serif', fontSize:'22px', color:T.t1, marginBottom:'12px', fontStyle:'italic' }}>
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
                        <div style={{ fontSize:'10px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', color:T.t3, marginBottom:'2px' }}>{row.label}</div>
                        <div style={{ fontSize:'13px', color:T.t1 }}>{row.value}</div>
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
                    <div key={s.label} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'12px 14px', transition:'background 0.2s' }}>
                      <div style={{ fontSize:'10px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', color:T.t3, marginBottom:'4px' }}>{s.label}</div>
                      <div style={{ fontFamily:'Georgia,serif', fontSize:'22px', color:T.t1 }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:'8px', overflow:'hidden', transition:'background 0.2s' }}>
                  <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, fontFamily:'Georgia,serif', fontSize:'14px', fontStyle:'italic', color:T.t1 }}>
                    Booking history
                  </div>
                  {bookings.length===0 ? (
                    <div style={{ padding:'24px', textAlign:'center', color:T.t3, fontSize:'13px' }}>No bookings yet</div>
                  ) : bookings.map(b => {
                    const sc = STATUS_STYLES[b.status] ?? STATUS_STYLES.pending
                    return (
                      <div key={b.id} style={{ padding:'12px 16px', borderBottom:`1px solid ${T.divider}`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px' }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:'13px', fontWeight:500, color:T.t1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.services?.name}</div>
                          <div style={{ fontSize:'11px', color:T.t3, fontFamily:'monospace', marginTop:'2px' }}>{fmtDate(b.starts_at)}</div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                          <span style={{ fontSize:'12px', color:T.t2 }}>{fmtPrice(b.price_cents)}</span>
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
