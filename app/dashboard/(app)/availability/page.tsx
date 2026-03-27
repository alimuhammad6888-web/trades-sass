'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useTenant } from '@/lib/tenant-context'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DAYS = [
  { key:'mon', label:'Monday' }, { key:'tue', label:'Tuesday' },
  { key:'wed', label:'Wednesday' }, { key:'thu', label:'Thursday' },
  { key:'fri', label:'Friday' }, { key:'sat', label:'Saturday' },
  { key:'sun', label:'Sunday' },
]

const TIME_OPTIONS = [
  '6:00 AM','6:30 AM','7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM','1:00 PM','1:30 PM',
  '2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM','5:00 PM','5:30 PM',
  '6:00 PM','6:30 PM','7:00 PM','7:30 PM','8:00 PM',
]

const STAFF_COLORS = ['#3B82C4','#34A668','#E07B2A','#8B5CF6','#EC4899','#F4C300','#EF4444']

function toDisplay(t: string|null) {
  if (!t) return '8:00 AM'
  const [h,m] = t.split(':').map(Number)
  return `${h%12||12}:${m.toString().padStart(2,'0')} ${h>=12?'PM':'AM'}`
}
function to24(d: string) {
  if (!d) return null
  const [time,ampm] = d.split(' ')
  let [h,m] = time.split(':').map(Number)
  if (ampm==='PM'&&h!==12) h+=12
  if (ampm==='AM'&&h===12) h=0
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`
}

type DayRow = { id:string; day:string; is_open:boolean; open_time:string|null; close_time:string|null }
type Staff  = { id:string; first_name:string; last_name:string; phone:string; role:string; is_active:boolean; color:string; availability?:Record<string,{is_working:boolean;start_time:string|null;end_time:string|null}> }
const EMPTY = { first_name:'', last_name:'', phone:'', role:'technician', color:'#3B82C4' }

export default function AvailabilityPage() {
  const { tenant } = useTenant()
  const [tab, setTab]               = useState<'hours'|'staff'>('hours')
  const [hours, setHours]           = useState<DayRow[]>([])
  const [staff, setStaff]           = useState<Staff[]>([])
  const [sel, setSel]               = useState<Staff|null>(null)
  const [fetched, setFetched]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [sendingSMS, setSendingSMS] = useState(false)
  const [drawer, setDrawer]         = useState<'add'|'edit'|null>(null)
  const [drawerData, setDrawerData] = useState(EMPTY)
  const [editId, setEditId]         = useState<string|null>(null)
  const [drawerSaving, setDrawerSaving] = useState(false)

  useEffect(() => {
    if (!tenant?.id) return
    loadAll()
  }, [tenant?.id])

  async function loadAll() {
    await Promise.all([loadHours(), loadStaff()])
    setFetched(true)
  }

  async function loadHours() {
    const { data } = await supabase.from('business_hours').select('*').eq('tenant_id', tenant!.id)
    if (data?.length) setHours(DAYS.map(d=>data.find((r:any)=>r.day===d.key)).filter(Boolean) as DayRow[])
    else setHours(DAYS.map(d=>({ id:'', day:d.key, is_open:!['sat','sun'].includes(d.key), open_time:!['sat','sun'].includes(d.key)?'08:00':null, close_time:!['sat','sun'].includes(d.key)?'17:00':null })))
  }

  async function loadStaff() {
    const { data:sd } = await supabase.from('staff').select('*').eq('tenant_id', tenant!.id).order('first_name')
    if (!sd) return
    const { data:ad } = await supabase.from('staff_availability').select('*').eq('tenant_id', tenant!.id)
    const result = sd.map((s:any) => {
      const avail:Record<string,any>={}
      DAYS.forEach(d => { const r=ad?.find((a:any)=>a.staff_id===s.id&&a.day===d.key); avail[d.key]=r?{is_working:r.is_working,start_time:r.start_time,end_time:r.end_time}:{is_working:false,start_time:'08:00',end_time:'17:00'} })
      return {...s,availability:avail}
    })
    setStaff(result)
    if (sel) { const u=result.find((s:any)=>s.id===sel.id); if(u) setSel(u) }
  }

  function updateHour(day:string, field:string, value:any) { setHours(p=>p.map(h=>h.day===day?{...h,[field]:value}:h)) }
  function updateAvail(sid:string, day:string, field:string, value:any) {
    const upd=(s:Staff)=>s.id!==sid?s:{...s,availability:{...s.availability,[day]:{...s.availability?.[day],[field]:value}}}
    setStaff(p=>p.map(upd)); setSel(p=>p?.id===sid?upd(p):p)
  }

  async function saveHours() {
    setSaving(true)
    await Promise.all(hours.map(h=>supabase.from('business_hours').upsert({tenant_id:tenant!.id,day:h.day,is_open:h.is_open,open_time:h.is_open?h.open_time:null,close_time:h.is_open?h.close_time:null},{onConflict:'tenant_id,day'})))
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2500)
  }

  async function saveStaffAvail() {
    if (!sel) return
    setSaving(true)
    await Promise.all(DAYS.map(d=>{const a=sel.availability?.[d.key];return supabase.from('staff_availability').upsert({tenant_id:tenant!.id,staff_id:sel.id,day:d.key,is_working:a?.is_working??false,start_time:a?.is_working?a.start_time:null,end_time:a?.is_working?a.end_time:null},{onConflict:'staff_id,day'})}))
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2500); loadStaff()
  }

  async function toggleActive(id:string, current:boolean) { await supabase.from('staff').update({is_active:!current}).eq('id',id); loadStaff() }

  async function saveDrawer() {
    if (!drawerData.first_name||!drawerData.last_name) return
    setDrawerSaving(true)
    if (drawer==='add') {
      const {data:s}=await supabase.from('staff').insert({tenant_id:tenant!.id,...drawerData}).select('id').single() as any
      if(s) await Promise.all(DAYS.map(d=>supabase.from('staff_availability').insert({tenant_id:tenant!.id,staff_id:s.id,day:d.key,is_working:!['sat','sun'].includes(d.key),start_time:!['sat','sun'].includes(d.key)?'08:00':null,end_time:!['sat','sun'].includes(d.key)?'17:00':null})))
    } else if(editId) {
      await supabase.from('staff').update({first_name:drawerData.first_name,last_name:drawerData.last_name,phone:drawerData.phone,role:drawerData.role,color:drawerData.color}).eq('id',editId)
    }
    setDrawerSaving(false); setDrawer(null); loadStaff()
  }

  async function sendDailyJobList() {
    setSendingSMS(true)
    const ts=new Date().toISOString().split('T')[0]
    const {data:bookings}=await supabase.from('bookings').select(`id,starts_at,notes,assigned_staff_id,customers(first_name,last_name,phone,address_line1,city),services(name)`).eq('tenant_id',tenant!.id).in('status',['confirmed','pending']).gte('starts_at',ts+'T00:00:00').lte('starts_at',ts+'T23:59:59').order('starts_at')
    if (!bookings?.length){alert('No bookings today.');setSendingSMS(false);return}
    const byStaff:Record<string,any[]>={}
    bookings.forEach((b:any)=>{const sid=b.assigned_staff_id??'unassigned';if(!byStaff[sid])byStaff[sid]=[];byStaff[sid].push(b)})
    let cnt=0
    for(const s of staff.filter(s=>s.is_active&&s.phone)){
      const jobs=byStaff[s.id]??[];if(!jobs.length)continue
      const lines=jobs.map((b:any,i:number)=>{const t=new Date(b.starts_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});const c=b.customers;const addr=c?.address_line1?`${c.address_line1}${c.city?', '+c.city:''}`:'No address';return `${i+1}. ${t} — ${b.services?.name}\n   ${c?.first_name} ${c?.last_name} | ${c?.phone??'no phone'}\n   ${addr}${b.notes?'\n   Note: '+b.notes:''}`}).join('\n\n')
      console.log(`[SMS → ${s.first_name} (${s.phone})]:\nHi ${s.first_name}! Your jobs today:\n\n${lines}\n\n— BigBoss Electric`);cnt++
    }
    setSendingSMS(false);alert(`Sent to ${cnt} staff. Check console (Cmd+Option+J) to preview.`)
  }

  const S:any={padding:'6px 10px',background:'#fff',border:'1px solid #e8e4dc',borderRadius:'6px',fontSize:'13px',color:'#1a1917',fontFamily:'sans-serif',cursor:'pointer',outline:'none'}
  const I:any={width:'100%',padding:'8px 11px',border:'1px solid #e8e4dc',borderRadius:'6px',fontSize:'13px',fontFamily:'sans-serif',color:'#1a1917',outline:'none',boxSizing:'border-box' as any}
  const L:any={fontSize:'11px',fontWeight:500,color:'#9a9590',textTransform:'uppercase' as any,letterSpacing:'0.06em',display:'block',marginBottom:'5px'}

  return (
    <div style={{minHeight:'100vh',background:'#f8f6f1',fontFamily:'sans-serif'}}>
      <div style={{padding:'24px 28px 0',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap' as any,gap:'10px'}}>
        <div>
          <h1 style={{fontFamily:'Georgia, serif',fontSize:'22px',fontStyle:'italic',color:'#1a1917',marginBottom:'4px'}}>Availability & Staff</h1>
          <p style={{fontSize:'13px',color:'#9a9590'}}>Business hours and team schedules</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          {saved&&<span style={{fontSize:'13px',color:'#1a6b4a'}}>✓ Saved</span>}
          <button onClick={sendDailyJobList} disabled={sendingSMS} style={{padding:'7px 14px',background:'transparent',color:'#9a9590',border:'1px solid #e8e4dc',borderRadius:'6px',fontSize:'12px',cursor:'pointer',fontFamily:'sans-serif'}}>{sendingSMS?'Sending...':'📱 Send job list'}</button>
          <button onClick={tab==='hours'?saveHours:saveStaffAvail} disabled={saving||!fetched} style={{padding:'8px 20px',background:'#1a1917',color:'#fff',border:'none',borderRadius:'6px',fontSize:'13px',fontWeight:500,cursor:saving?'not-allowed':'pointer',opacity:saving||!fetched?0.5:1,fontFamily:'sans-serif'}}>{saving?'Saving...':'Save changes'}</button>
        </div>
      </div>

      <div style={{background:'#fff',borderBottom:'1px solid #e8e4dc',padding:'0 28px',display:'flex',marginTop:'16px'}}>
        {(['hours','staff'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'12px 16px',border:'none',borderBottom:`2px solid ${tab===t?'#1a1917':'transparent'}`,background:'transparent',fontSize:'13px',fontWeight:500,color:tab===t?'#1a1917':'#9a9590',cursor:'pointer',fontFamily:'sans-serif'}}>
            {t==='hours'?'Business Hours':'Staff & Schedules'}
          </button>
        ))}
      </div>

      {!fetched ? (
        <div style={{padding:'28px'}}>
          {[1,2,3,4,5,6,7].map(i=><div key={i} style={{background:'#fff',border:'1px solid #e8e4dc',borderRadius:'8px',height:'52px',marginBottom:'8px',animation:'pulse 1.5s ease infinite'}}/>)}
        </div>
      ) : (
        <div style={{padding:'24px 28px',maxWidth:'900px'}}>
          {tab==='hours'&&(
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px',flexWrap:'wrap' as any,gap:'10px'}}>
                <div style={{fontSize:'13px',color:'#9a9590'}}>The outer boundary — staff schedules work within these hours</div>
                <button onClick={()=>{const mon=hours.find(h=>h.day==='mon');if(!mon)return;setHours(p=>p.map(h=>['mon','tue','wed','thu','fri'].includes(h.day)?{...h,is_open:mon.is_open,open_time:mon.open_time,close_time:mon.close_time}:h))}} style={{padding:'6px 14px',background:'#fff',border:'1px solid #e8e4dc',borderRadius:'6px',fontSize:'12px',color:'#4a4843',cursor:'pointer',fontFamily:'sans-serif'}}>Copy Mon → all weekdays</button>
              </div>
              <div style={{background:'#fff',border:'1px solid #e8e4dc',borderRadius:'8px',overflow:'hidden'}}>
                {hours.map((h,i)=>(
                  <div key={h.day} style={{display:'flex',alignItems:'center',padding:'14px 20px',borderBottom:i<hours.length-1?'1px solid #f0ede6':'none',gap:'16px',flexWrap:'wrap' as any}}>
                    <div style={{width:'130px',flexShrink:0,display:'flex',alignItems:'center',gap:'10px'}}>
                      <div onClick={()=>updateHour(h.day,'is_open',!h.is_open)} style={{width:'36px',height:'20px',borderRadius:'10px',background:h.is_open?'#1a1917':'#e8e4dc',cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}>
                        <div style={{position:'absolute',top:'2px',left:h.is_open?'18px':'2px',width:'16px',height:'16px',borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
                      </div>
                      <span style={{fontSize:'14px',fontWeight:500,color:h.is_open?'#1a1917':'#c8c4bc'}}>{DAYS.find(d=>d.key===h.day)?.label}</span>
                    </div>
                    {h.is_open?(
                      <div style={{display:'flex',alignItems:'center',gap:'8px',flex:1}}>
                        <select style={S} value={toDisplay(h.open_time)} onChange={e=>updateHour(h.day,'open_time',to24(e.target.value))}>{TIME_OPTIONS.map(t=><option key={t}>{t}</option>)}</select>
                        <span style={{fontSize:'13px',color:'#9a9590'}}>to</span>
                        <select style={S} value={toDisplay(h.close_time)} onChange={e=>updateHour(h.day,'close_time',to24(e.target.value))}>{TIME_OPTIONS.map(t=><option key={t}>{t}</option>)}</select>
                      </div>
                    ):<span style={{fontSize:'13px',color:'#c8c4bc',fontStyle:'italic'}}>Closed</span>}
                  </div>
                ))}
              </div>
            </>
          )}

          {tab==='staff'&&(
            <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:'20px'}}>
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
                  <h2 style={{fontFamily:'Georgia, serif',fontSize:'16px',fontStyle:'italic',color:'#1a1917'}}>Team ({staff.length}/5)</h2>
                  {staff.length<5&&<button onClick={()=>{setDrawerData(EMPTY);setEditId(null);setDrawer('add')}} style={{padding:'5px 12px',background:'#1a1917',color:'#fff',border:'none',borderRadius:'6px',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'sans-serif'}}>+ Add</button>}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                  {staff.map(s=>(
                    <div key={s.id} onClick={()=>setSel(s)} style={{background:sel?.id===s.id?'#eef4fb':'#fff',border:`1px solid ${sel?.id===s.id?'#3B82C4':'#e8e4dc'}`,borderRadius:'8px',padding:'10px 12px',cursor:'pointer'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <div style={{width:'32px',height:'32px',borderRadius:'50%',background:s.color,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'12px',fontWeight:700,color:'#fff'}}>{s.first_name[0]}{s.last_name[0]}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'13px',fontWeight:600,color:s.is_active?'#1a1917':'#9a9590',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.first_name} {s.last_name}{!s.is_active&&<span style={{marginLeft:'6px',fontSize:'10px',color:'#c8c4bc',fontWeight:400}}>(inactive)</span>}</div>
                          <div style={{fontSize:'11px',color:'#9a9590'}}>{s.phone||'No phone'}</div>
                        </div>
                        <div onClick={e=>{e.stopPropagation();toggleActive(s.id,s.is_active)}} style={{width:'28px',height:'16px',borderRadius:'8px',background:s.is_active?'#1a1917':'#e8e4dc',cursor:'pointer',position:'relative',flexShrink:0,transition:'background 0.2s'}}>
                          <div style={{position:'absolute',top:'2px',left:s.is_active?'14px':'2px',width:'12px',height:'12px',borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
                        </div>
                      </div>
                      <button onClick={e=>{e.stopPropagation();setDrawerData({first_name:s.first_name,last_name:s.last_name,phone:s.phone,role:s.role,color:s.color});setEditId(s.id);setDrawer('edit')}} style={{marginTop:'8px',width:'100%',padding:'5px',background:'transparent',border:'1px solid #e8e4dc',borderRadius:'5px',fontSize:'11px',color:'#9a9590',cursor:'pointer',fontFamily:'sans-serif',textAlign:'center' as any}}>Edit details</button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                {!sel?(
                  <div style={{background:'#fff',border:'1px solid #e8e4dc',borderRadius:'8px',padding:'40px',textAlign:'center' as any,color:'#9a9590',fontSize:'14px',fontStyle:'italic',fontFamily:'Georgia, serif'}}>Select a team member to edit their schedule</div>
                ):(
                  <>
                    <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px'}}>
                      <div style={{width:'40px',height:'40px',borderRadius:'50%',background:sel.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px',fontWeight:700,color:'#fff'}}>{sel.first_name[0]}{sel.last_name[0]}</div>
                      <div>
                        <div style={{fontFamily:'Georgia, serif',fontSize:'16px',fontStyle:'italic',color:'#1a1917'}}>{sel.first_name} {sel.last_name}</div>
                        <div style={{fontSize:'12px',color:'#9a9590'}}>{sel.phone||'No phone set'}</div>
                      </div>
                    </div>
                    <div style={{background:'#fff',border:'1px solid #e8e4dc',borderRadius:'8px',overflow:'hidden'}}>
                      {DAYS.map((d,i)=>{
                        const avail=sel.availability?.[d.key]??{is_working:false,start_time:'08:00',end_time:'17:00'}
                        const bizOpen=hours.find(h=>h.day===d.key)?.is_open??false
                        return(
                          <div key={d.key} style={{display:'flex',alignItems:'center',padding:'12px 16px',borderBottom:i<6?'1px solid #f0ede6':'none',gap:'14px',opacity:bizOpen?1:0.35}}>
                            <div style={{width:'130px',flexShrink:0,display:'flex',alignItems:'center',gap:'10px'}}>
                              <div onClick={()=>bizOpen&&updateAvail(sel.id,d.key,'is_working',!avail.is_working)} style={{width:'32px',height:'18px',borderRadius:'9px',background:avail.is_working&&bizOpen?sel.color:'#e8e4dc',cursor:bizOpen?'pointer':'not-allowed',position:'relative',transition:'background 0.2s',flexShrink:0}}>
                                <div style={{position:'absolute',top:'2px',left:avail.is_working?'16px':'2px',width:'14px',height:'14px',borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
                              </div>
                              <span style={{fontSize:'13px',fontWeight:500,color:avail.is_working&&bizOpen?'#1a1917':'#c8c4bc'}}>{d.label}</span>
                            </div>
                            {avail.is_working&&bizOpen?(
                              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                <select style={S} value={toDisplay(avail.start_time)} onChange={e=>updateAvail(sel.id,d.key,'start_time',to24(e.target.value))}>{TIME_OPTIONS.map(t=><option key={t}>{t}</option>)}</select>
                                <span style={{fontSize:'13px',color:'#9a9590'}}>to</span>
                                <select style={S} value={toDisplay(avail.end_time)} onChange={e=>updateAvail(sel.id,d.key,'end_time',to24(e.target.value))}>{TIME_OPTIONS.map(t=><option key={t}>{t}</option>)}</select>
                              </div>
                            ):<span style={{fontSize:'13px',color:'#c8c4bc',fontStyle:'italic'}}>{bizOpen?'Not working':'Business closed'}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div style={{marginTop:'16px',background:'#eef4fb',border:'1px solid #d0e4f7',borderRadius:'6px',padding:'12px 16px',fontSize:'13px',color:'#1e4d8c',lineHeight:1.5}}>
            💡 Staff schedules work within business hours. Customers only see slots when at least one staff member is available.
          </div>
        </div>
      )}

      {drawer&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'flex-end'}} onClick={()=>setDrawer(null)}>
          <div style={{background:'#fff',width:'360px',height:'100%',padding:'28px 24px',overflowY:'auto',boxShadow:'-4px 0 20px rgba(0,0,0,0.1)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
              <h3 style={{fontFamily:'Georgia, serif',fontSize:'18px',fontStyle:'italic',color:'#1a1917'}}>{drawer==='add'?'Add employee':'Edit employee'}</h3>
              <button onClick={()=>setDrawer(null)} style={{background:'none',border:'none',fontSize:'22px',cursor:'pointer',color:'#9a9590'}}>×</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div><label style={L}>First name *</label><input style={I} value={drawerData.first_name} onChange={e=>setDrawerData(d=>({...d,first_name:e.target.value}))} /></div>
                <div><label style={L}>Last name *</label><input style={I} value={drawerData.last_name} onChange={e=>setDrawerData(d=>({...d,last_name:e.target.value}))} /></div>
              </div>
              <div><label style={L}>Phone</label><input style={I} type="tel" value={drawerData.phone} onChange={e=>setDrawerData(d=>({...d,phone:e.target.value}))} placeholder="(555) 000-0000" /><div style={{fontSize:'11px',color:'#9a9590',marginTop:'4px'}}>Used for daily job list SMS</div></div>
              <div><label style={L}>Role</label><select style={{...I,cursor:'pointer'}} value={drawerData.role} onChange={e=>setDrawerData(d=>({...d,role:e.target.value}))}><option value="technician">Technician</option><option value="apprentice">Apprentice</option><option value="manager">Manager</option><option value="supervisor">Supervisor</option></select></div>
              <div><label style={L}>Color</label><div style={{display:'flex',gap:'8px',flexWrap:'wrap' as any}}>{STAFF_COLORS.map(c=><div key={c} onClick={()=>setDrawerData(d=>({...d,color:c}))} style={{width:'28px',height:'28px',borderRadius:'50%',background:c,cursor:'pointer',border:`3px solid ${drawerData.color===c?'#1a1917':'transparent'}`,boxSizing:'border-box' as any}}/>)}</div></div>
              <div style={{borderTop:'1px solid #f0ede6',paddingTop:'16px',display:'flex',gap:'10px'}}>
                <button onClick={saveDrawer} disabled={drawerSaving||!drawerData.first_name||!drawerData.last_name} style={{flex:1,padding:'10px',background:'#1a1917',color:'#fff',border:'none',borderRadius:'6px',fontSize:'14px',fontWeight:500,cursor:'pointer',opacity:drawerSaving||!drawerData.first_name||!drawerData.last_name?0.5:1,fontFamily:'sans-serif'}}>{drawerSaving?'Saving...':drawer==='add'?'Add employee':'Save changes'}</button>
                <button onClick={()=>setDrawer(null)} style={{padding:'10px 16px',background:'transparent',color:'#9a9590',border:'1px solid #e8e4dc',borderRadius:'6px',fontSize:'14px',cursor:'pointer',fontFamily:'sans-serif'}}>Cancel</button>
              </div>
              {drawer==='edit'&&(
                <div style={{borderTop:'1px solid #f0ede6',paddingTop:'16px'}}>
                  <div style={{fontSize:'11px',color:'#9a9590',marginBottom:'8px',textTransform:'uppercase' as any,letterSpacing:'0.06em',fontWeight:500}}>Danger zone</div>
                  <button onClick={async()=>{if(!editId)return;const s=staff.find(s=>s.id===editId);if(!s)return;await toggleActive(editId,s.is_active);setDrawer(null)}} style={{width:'100%',padding:'8px',background:'transparent',color:'#8c2820',border:'1px solid #8c282044',borderRadius:'6px',fontSize:'13px',cursor:'pointer',fontFamily:'sans-serif'}}>
                    {staff.find(s=>s.id===editId)?.is_active?'Deactivate employee':'Reactivate employee'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }`}</style>
    </div>
  )
}
