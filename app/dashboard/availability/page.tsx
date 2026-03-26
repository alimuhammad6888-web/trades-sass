'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { resolveTenant } from '@/lib/tenant'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

const TIME_OPTIONS = [
  '6:00 AM','6:30 AM','7:00 AM','7:30 AM',
  '8:00 AM','8:30 AM','9:00 AM','9:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM',
  '12:00 PM','12:30 PM','1:00 PM','1:30 PM',
  '2:00 PM','2:30 PM','3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM','5:00 PM','5:30 PM',
  '6:00 PM','6:30 PM','7:00 PM','7:30 PM','8:00 PM',
]

const STAFF_COLORS = ['#3B82C4','#34A668','#E07B2A','#8B5CF6','#EC4899','#F4C300','#EF4444']

function toDisplay(t: string | null) {
  if (!t) return '8:00 AM'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2,'0')} ${ampm}`
}

function to24(display: string) {
  if (!display) return null
  const [time, ampm] = display.split(' ')
  let [h, m] = time.split(':').map(Number)
  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`
}

type DayRow = { id: string; day: string; is_open: boolean; open_time: string | null; close_time: string | null }
type StaffMember = {
  id: string; first_name: string; last_name: string; phone: string
  role: string; is_active: boolean; color: string
  availability?: Record<string, { is_working: boolean; start_time: string | null; end_time: string | null }>
}

const EMPTY_STAFF = { first_name:'', last_name:'', phone:'', role:'technician', color:'#3B82C4' }

export default function AvailabilityPage() {
  const router = useRouter()
  const [tab, setTab]               = useState<'hours'|'staff'>('hours')
  const [tenantId, setTenantId]     = useState('')
  const [hours, setHours]           = useState<DayRow[]>([])
  const [staff, setStaff]           = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [sendingSMS, setSendingSMS] = useState(false)
  const [smsSent, setSmsSent]       = useState(false)

  // Staff drawer state
  const [drawerMode, setDrawerMode] = useState<'add'|'edit'|null>(null)
  const [drawerStaff, setDrawerStaff] = useState(EMPTY_STAFF)
  const [editingId, setEditingId]   = useState<string|null>(null)
  const [drawerSaving, setDrawerSaving] = useState(false)

  useEffect(() => { checkAuth(); loadAll() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) router.push('/dashboard/login')
  }

  async function loadAll() {
    setLoading(true)
    const t = await resolveTenant()
    if (!t) return
    setTenantId(t.id)
    await Promise.all([loadHours(t.id), loadStaff(t.id)])
    setLoading(false)
  }

  async function loadHours(tid: string) {
    const { data } = await supabase.from('business_hours').select('*').eq('tenant_id', tid)
    if (data && data.length > 0) {
      setHours(DAYS.map(d => data.find((r: any) => r.day === d.key)).filter(Boolean) as DayRow[])
    } else {
      setHours(DAYS.map(d => ({ id:'', day:d.key, is_open:!['sat','sun'].includes(d.key), open_time:!['sat','sun'].includes(d.key)?'08:00':null, close_time:!['sat','sun'].includes(d.key)?'17:00':null })))
    }
  }

  async function loadStaff(tid: string) {
    const { data: staffData } = await supabase.from('staff').select('*').eq('tenant_id', tid).order('first_name')
    if (!staffData) return
    const { data: availData } = await supabase.from('staff_availability').select('*').eq('tenant_id', tid)
    const staffWithAvail = staffData.map((s: any) => {
      const avail: Record<string, any> = {}
      DAYS.forEach(d => {
        const row = availData?.find((a: any) => a.staff_id === s.id && a.day === d.key)
        avail[d.key] = row
          ? { is_working: row.is_working, start_time: row.start_time, end_time: row.end_time }
          : { is_working: false, start_time: '08:00', end_time: '17:00' }
      })
      return { ...s, availability: avail }
    })
    setStaff(staffWithAvail)
    // Keep selected staff in sync
    if (selectedStaff) {
      const updated = staffWithAvail.find((s: any) => s.id === selectedStaff.id)
      if (updated) setSelectedStaff(updated)
    }
  }

  function updateHour(day: string, field: string, value: any) {
    setHours(prev => prev.map(h => h.day === day ? { ...h, [field]: value } : h))
  }

  function updateStaffAvail(staffId: string, day: string, field: string, value: any) {
    const update = (s: StaffMember) => s.id !== staffId ? s : {
      ...s, availability: { ...s.availability, [day]: { ...s.availability?.[day], [field]: value } }
    }
    setStaff(prev => prev.map(update))
    setSelectedStaff(prev => prev?.id === staffId ? update(prev) : prev)
  }

  async function saveHours() {
    setSaving(true)
    await Promise.all(hours.map(h =>
      supabase.from('business_hours').upsert({
        tenant_id: tenantId, day: h.day, is_open: h.is_open,
        open_time: h.is_open ? h.open_time : null,
        close_time: h.is_open ? h.close_time : null,
      }, { onConflict: 'tenant_id,day' })
    ))
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  async function saveStaffAvail() {
    if (!selectedStaff) return
    setSaving(true)
    await Promise.all(DAYS.map(d => {
      const a = selectedStaff.availability?.[d.key]
      return supabase.from('staff_availability').upsert({
        tenant_id: tenantId, staff_id: selectedStaff.id, day: d.key,
        is_working: a?.is_working ?? false,
        start_time: a?.is_working ? a.start_time : null,
        end_time: a?.is_working ? a.end_time : null,
      }, { onConflict: 'staff_id,day' })
    }))
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
    loadStaff(tenantId)
  }

  async function toggleStaffActive(id: string, current: boolean) {
    await supabase.from('staff').update({ is_active: !current }).eq('id', id)
    loadStaff(tenantId)
  }

  function openAddDrawer() {
    setDrawerStaff(EMPTY_STAFF)
    setEditingId(null)
    setDrawerMode('add')
  }

  function openEditDrawer(s: StaffMember) {
    setDrawerStaff({ first_name: s.first_name, last_name: s.last_name, phone: s.phone, role: s.role, color: s.color })
    setEditingId(s.id)
    setDrawerMode('edit')
  }

  async function saveDrawer() {
    if (!drawerStaff.first_name || !drawerStaff.last_name) return
    setDrawerSaving(true)

    if (drawerMode === 'add') {
      const { data: s } = await supabase.from('staff').insert({ tenant_id: tenantId, ...drawerStaff }).select('id').single() as any
      if (s) {
        await Promise.all(DAYS.map(d =>
          supabase.from('staff_availability').insert({
            tenant_id: tenantId, staff_id: s.id, day: d.key,
            is_working: !['sat','sun'].includes(d.key),
            start_time: !['sat','sun'].includes(d.key) ? '08:00' : null,
            end_time: !['sat','sun'].includes(d.key) ? '17:00' : null,
          })
        ))
      }
    } else if (drawerMode === 'edit' && editingId) {
      await supabase.from('staff').update({
        first_name: drawerStaff.first_name,
        last_name:  drawerStaff.last_name,
        phone:      drawerStaff.phone,
        role:       drawerStaff.role,
        color:      drawerStaff.color,
      }).eq('id', editingId)
    }

    setDrawerSaving(false)
    setDrawerMode(null)
    loadStaff(tenantId)
  }

  async function sendDailyJobList() {
    setSendingSMS(true)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const { data: bookings } = await supabase
      .from('bookings')
      .select(`id, starts_at, notes, assigned_staff_id, customers(first_name, last_name, phone, address_line1, city), services(name)`)
      .eq('tenant_id', tenantId)
      .in('status', ['confirmed','pending'])
      .gte('starts_at', todayStr + 'T00:00:00')
      .lte('starts_at', todayStr + 'T23:59:59')
      .order('starts_at')

    if (!bookings || bookings.length === 0) {
      alert('No bookings scheduled for today.')
      setSendingSMS(false)
      return
    }

    const byStaff: Record<string, any[]> = {}
    bookings.forEach((b: any) => {
      const sid = b.assigned_staff_id ?? 'unassigned'
      if (!byStaff[sid]) byStaff[sid] = []
      byStaff[sid].push(b)
    })

    let sentCount = 0
    for (const s of staff.filter(s => s.is_active && s.phone)) {
      const jobs = byStaff[s.id] ?? []
      if (jobs.length === 0) continue
      const lines = jobs.map((b: any, i: number) => {
        const time = new Date(b.starts_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })
        const c = b.customers
        const addr = c?.address_line1 ? `${c.address_line1}${c.city ? ', ' + c.city : ''}` : 'No address'
        return `${i+1}. ${time} — ${b.services?.name}\n   ${c?.first_name} ${c?.last_name} | ${c?.phone ?? 'no phone'}\n   ${addr}${b.notes ? '\n   Note: ' + b.notes : ''}`
      }).join('\n\n')
      const message = `Hi ${s.first_name}! Your jobs today:\n\n${lines}\n\n— BigBoss Electric`
      console.log(`[SMS → ${s.first_name} ${s.last_name} (${s.phone})]:\n${message}\n`)
      sentCount++
    }

    setSendingSMS(false); setSmsSent(true); setTimeout(() => setSmsSent(false), 3000)
    alert(`Job list sent to ${sentCount} staff member(s).\nCheck browser console (Cmd+Option+J) to preview SMS content.`)
  }

  const sel: any = { padding:'6px 10px', background:'#fff', border:'1px solid #e8e4dc', borderRadius:'6px', fontSize:'13px', color:'#1a1917', fontFamily:'sans-serif', cursor:'pointer', outline:'none' }
  const inp: any = { width:'100%', padding:'8px 11px', border:'1px solid #e8e4dc', borderRadius:'6px', fontSize:'13px', fontFamily:'sans-serif', color:'#1a1917', outline:'none', boxSizing:'border-box' as any }
  const lbl: any = { fontSize:'11px', fontWeight:500, color:'#9a9590', textTransform:'uppercase' as any, letterSpacing:'0.06em', display:'block', marginBottom:'5px' }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#f8f6f1', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif', color:'#9a9590' }}>Loading...</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f8f6f1', fontFamily:'sans-serif' }}>

      {/* Top bar */}
      <div style={{ background:'#1a1917', padding:'0 24px', height:'52px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'20px' }}>
          <a href="/dashboard" style={{ color:'#888', fontSize:'13px', textDecoration:'none' }}>← Overview</a>
          <span style={{ color:'#f0ede6', fontSize:'16px', fontFamily:'Georgia, serif', fontStyle:'italic' }}>Availability & Staff</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {saved && <span style={{ fontSize:'13px', color:'#1a6b4a' }}>✓ Saved</span>}
          {smsSent && <span style={{ fontSize:'13px', color:'#1a6b4a' }}>✓ SMS sent</span>}
          <button onClick={sendDailyJobList} disabled={sendingSMS}
            style={{ padding:'7px 14px', background:'transparent', color:'#9a9590', border:'1px solid #444', borderRadius:'6px', fontSize:'12px', cursor:'pointer', fontFamily:'sans-serif' }}>
            {sendingSMS ? 'Sending...' : '📱 Send job list'}
          </button>
          <button onClick={tab === 'hours' ? saveHours : saveStaffAvail} disabled={saving}
            style={{ padding:'7px 18px', background:'#f0ede6', color:'#1a1917', border:'none', borderRadius:'6px', fontSize:'13px', fontWeight:500, cursor:saving?'not-allowed':'pointer', opacity:saving?0.6:1, fontFamily:'sans-serif' }}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e8e4dc', padding:'0 24px', display:'flex' }}>
        {(['hours','staff'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'12px 16px', border:'none', borderBottom:`2px solid ${tab===t?'#1a1917':'transparent'}`, background:'transparent', fontSize:'13px', fontWeight:500, color:tab===t?'#1a1917':'#9a9590', cursor:'pointer', fontFamily:'sans-serif' }}>
            {t === 'hours' ? 'Business Hours' : 'Staff & Schedules'}
          </button>
        ))}
      </div>

      <div style={{ padding:'24px', maxWidth:'900px', margin:'0 auto' }}>

        {/* ── BUSINESS HOURS ── */}
        {tab === 'hours' && (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
              <div>
                <h2 style={{ fontFamily:'Georgia, serif', fontSize:'18px', fontStyle:'italic', color:'#1a1917', marginBottom:'4px' }}>Business hours</h2>
                <p style={{ fontSize:'13px', color:'#9a9590' }}>The outer boundary — staff schedules work within these hours</p>
              </div>
              <button onClick={() => {
                const mon = hours.find(h => h.day === 'mon')
                if (!mon) return
                setHours(prev => prev.map(h => ['mon','tue','wed','thu','fri'].includes(h.day)
                  ? { ...h, is_open:mon.is_open, open_time:mon.open_time, close_time:mon.close_time } : h))
              }}
                style={{ padding:'6px 14px', background:'#fff', border:'1px solid #e8e4dc', borderRadius:'6px', fontSize:'12px', color:'#4a4843', cursor:'pointer', fontFamily:'sans-serif' }}>
                Copy Mon → all weekdays
              </button>
            </div>
            <div style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', overflow:'hidden' }}>
              {hours.map((h, i) => (
                <div key={h.day} style={{ display:'flex', alignItems:'center', padding:'14px 20px', borderBottom:i<hours.length-1?'1px solid #f0ede6':'none', gap:'16px', flexWrap:'wrap' }}>
                  <div style={{ width:'130px', flexShrink:0, display:'flex', alignItems:'center', gap:'10px' }}>
                    <div onClick={() => updateHour(h.day, 'is_open', !h.is_open)}
                      style={{ width:'36px', height:'20px', borderRadius:'10px', background:h.is_open?'#1a1917':'#e8e4dc', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
                      <div style={{ position:'absolute', top:'2px', left:h.is_open?'18px':'2px', width:'16px', height:'16px', borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
                    </div>
                    <span style={{ fontSize:'14px', fontWeight:500, color:h.is_open?'#1a1917':'#c8c4bc' }}>
                      {DAYS.find(d => d.key === h.day)?.label}
                    </span>
                  </div>
                  {h.is_open ? (
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', flex:1 }}>
                      <select style={sel} value={toDisplay(h.open_time)} onChange={e => updateHour(h.day, 'open_time', to24(e.target.value))}>
                        {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <span style={{ fontSize:'13px', color:'#9a9590' }}>to</span>
                      <select style={sel} value={toDisplay(h.close_time)} onChange={e => updateHour(h.day, 'close_time', to24(e.target.value))}>
                        {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  ) : (
                    <span style={{ fontSize:'13px', color:'#c8c4bc', fontStyle:'italic' }}>Closed</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── STAFF & SCHEDULES ── */}
        {tab === 'staff' && (
          <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:'20px' }}>

            {/* Staff list */}
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                <h2 style={{ fontFamily:'Georgia, serif', fontSize:'16px', fontStyle:'italic', color:'#1a1917' }}>Team ({staff.length}/5)</h2>
                {staff.length < 5 && (
                  <button onClick={openAddDrawer}
                    style={{ padding:'5px 12px', background:'#1a1917', color:'#fff', border:'none', borderRadius:'6px', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'sans-serif' }}>
                    + Add employee
                  </button>
                )}
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {staff.map(s => (
                  <div key={s.id} onClick={() => setSelectedStaff(s)}
                    style={{ background:selectedStaff?.id===s.id?'#eef4fb':'#fff', border:`1px solid ${selectedStaff?.id===s.id?'#3B82C4':'#e8e4dc'}`, borderRadius:'8px', padding:'10px 12px', cursor:'pointer' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:s.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'12px', fontWeight:700, color:'#fff' }}>
                        {s.first_name[0]}{s.last_name[0]}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'13px', fontWeight:600, color:s.is_active?'#1a1917':'#9a9590', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {s.first_name} {s.last_name}
                          {!s.is_active && <span style={{ marginLeft:'6px', fontSize:'10px', color:'#c8c4bc', fontWeight:400 }}>(inactive)</span>}
                        </div>
                        <div style={{ fontSize:'11px', color:'#9a9590' }}>{s.phone || 'No phone'}</div>
                      </div>
                      {/* Toggle active */}
                      <div onClick={e => { e.stopPropagation(); toggleStaffActive(s.id, s.is_active) }}
                        style={{ width:'28px', height:'16px', borderRadius:'8px', background:s.is_active?'#1a1917':'#e8e4dc', cursor:'pointer', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
                        <div style={{ position:'absolute', top:'2px', left:s.is_active?'14px':'2px', width:'12px', height:'12px', borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
                      </div>
                    </div>
                    {/* Edit button */}
                    <button
                      onClick={e => { e.stopPropagation(); openEditDrawer(s) }}
                      style={{ marginTop:'8px', width:'100%', padding:'5px', background:'transparent', border:'1px solid #e8e4dc', borderRadius:'5px', fontSize:'11px', color:'#9a9590', cursor:'pointer', fontFamily:'sans-serif', textAlign:'center' as any }}>
                      Edit details
                    </button>
                  </div>
                ))}

                {staff.length >= 5 && (
                  <div style={{ fontSize:'11px', color:'#9a9590', textAlign:'center' as any, padding:'8px', fontStyle:'italic' }}>
                    5 staff maximum on current plan
                  </div>
                )}
              </div>
            </div>

            {/* Staff schedule */}
            <div>
              {!selectedStaff ? (
                <div style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', padding:'40px', textAlign:'center' as any, color:'#9a9590', fontSize:'14px', fontStyle:'italic', fontFamily:'Georgia, serif' }}>
                  Select a team member to edit their schedule
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
                    <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:selectedStaff.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', fontWeight:700, color:'#fff' }}>
                      {selectedStaff.first_name[0]}{selectedStaff.last_name[0]}
                    </div>
                    <div>
                      <div style={{ fontFamily:'Georgia, serif', fontSize:'16px', fontStyle:'italic', color:'#1a1917' }}>{selectedStaff.first_name} {selectedStaff.last_name}</div>
                      <div style={{ fontSize:'12px', color:'#9a9590' }}>{selectedStaff.phone || 'No phone set'}</div>
                    </div>
                  </div>

                  <div style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:'8px', overflow:'hidden' }}>
                    {DAYS.map((d, i) => {
                      const avail = selectedStaff.availability?.[d.key] ?? { is_working:false, start_time:'08:00', end_time:'17:00' }
                      const bizDay = hours.find(h => h.day === d.key)
                      const bizOpen = bizDay?.is_open ?? false
                      return (
                        <div key={d.key} style={{ display:'flex', alignItems:'center', padding:'12px 16px', borderBottom:i<6?'1px solid #f0ede6':'none', gap:'14px', flexWrap:'wrap' as any, opacity:bizOpen?1:0.35 }}>
                          <div style={{ width:'130px', flexShrink:0, display:'flex', alignItems:'center', gap:'10px' }}>
                            <div onClick={() => bizOpen && updateStaffAvail(selectedStaff.id, d.key, 'is_working', !avail.is_working)}
                              style={{ width:'32px', height:'18px', borderRadius:'9px', background:avail.is_working&&bizOpen?selectedStaff.color:'#e8e4dc', cursor:bizOpen?'pointer':'not-allowed', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
                              <div style={{ position:'absolute', top:'2px', left:avail.is_working?'16px':'2px', width:'14px', height:'14px', borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
                            </div>
                            <span style={{ fontSize:'13px', fontWeight:500, color:avail.is_working&&bizOpen?'#1a1917':'#c8c4bc' }}>{d.label}</span>
                          </div>
                          {avail.is_working && bizOpen ? (
                            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                              <select style={sel} value={toDisplay(avail.start_time)} onChange={e => updateStaffAvail(selectedStaff.id, d.key, 'start_time', to24(e.target.value))}>
                                {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
                              </select>
                              <span style={{ fontSize:'13px', color:'#9a9590' }}>to</span>
                              <select style={sel} value={toDisplay(avail.end_time)} onChange={e => updateStaffAvail(selectedStaff.id, d.key, 'end_time', to24(e.target.value))}>
                                {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
                              </select>
                            </div>
                          ) : (
                            <span style={{ fontSize:'13px', color:'#c8c4bc', fontStyle:'italic' }}>
                              {bizOpen ? 'Not working' : 'Business closed'}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ marginTop:'10px', fontSize:'12px', color:'#9a9590', fontStyle:'italic' }}>
                    * Greyed out days are closed per business hours.
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop:'16px', background:'#eef4fb', border:'1px solid #d0e4f7', borderRadius:'6px', padding:'12px 16px', fontSize:'13px', color:'#1e4d8c', lineHeight:1.5 }}>
          💡 Staff schedules work within business hours. Customers only see slots when at least one staff member is available.
        </div>
      </div>

      {/* ── ADD / EDIT DRAWER ── */}
      {drawerMode && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'flex-end' }}
          onClick={() => setDrawerMode(null)}>
          <div style={{ background:'#fff', width:'360px', height:'100%', padding:'28px 24px', overflowY:'auto', boxShadow:'-4px 0 20px rgba(0,0,0,0.1)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
              <h3 style={{ fontFamily:'Georgia, serif', fontSize:'18px', fontStyle:'italic', color:'#1a1917' }}>
                {drawerMode === 'add' ? 'Add employee' : 'Edit employee'}
              </h3>
              <button onClick={() => setDrawerMode(null)} style={{ background:'none', border:'none', fontSize:'22px', cursor:'pointer', color:'#9a9590', lineHeight:1 }}>×</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={lbl}>First name *</label>
                  <input style={inp} value={drawerStaff.first_name} onChange={e => setDrawerStaff(d => ({...d, first_name:e.target.value}))} placeholder="Marcus" />
                </div>
                <div>
                  <label style={lbl}>Last name *</label>
                  <input style={inp} value={drawerStaff.last_name} onChange={e => setDrawerStaff(d => ({...d, last_name:e.target.value}))} placeholder="Rivera" />
                </div>
              </div>

              <div>
                <label style={lbl}>Phone number</label>
                <input style={inp} type="tel" value={drawerStaff.phone} onChange={e => setDrawerStaff(d => ({...d, phone:e.target.value}))} placeholder="(555) 000-0000" />
                <div style={{ fontSize:'11px', color:'#9a9590', marginTop:'4px' }}>Used for daily job list SMS</div>
              </div>

              <div>
                <label style={lbl}>Role</label>
                <select style={{ ...inp, cursor:'pointer' }} value={drawerStaff.role} onChange={e => setDrawerStaff(d => ({...d, role:e.target.value}))}>
                  <option value="technician">Technician</option>
                  <option value="apprentice">Apprentice</option>
                  <option value="manager">Manager</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              </div>

              <div>
                <label style={lbl}>Calendar color</label>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' as any }}>
                  {STAFF_COLORS.map(c => (
                    <div key={c} onClick={() => setDrawerStaff(d => ({...d, color:c}))}
                      style={{ width:'28px', height:'28px', borderRadius:'50%', background:c, cursor:'pointer', border:`3px solid ${drawerStaff.color===c?'#1a1917':'transparent'}`, boxSizing:'border-box' as any, transition:'border-color 0.15s' }} />
                  ))}
                </div>
                <div style={{ marginTop:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:drawerStaff.color, flexShrink:0 }} />
                  <span style={{ fontSize:'12px', color:'#9a9590' }}>
                    {drawerStaff.first_name || 'Employee'}'s color on the schedule
                  </span>
                </div>
              </div>

              <div style={{ borderTop:'1px solid #f0ede6', paddingTop:'16px', display:'flex', gap:'10px' }}>
                <button onClick={saveDrawer} disabled={drawerSaving || !drawerStaff.first_name || !drawerStaff.last_name}
                  style={{ flex:1, padding:'10px', background:'#1a1917', color:'#fff', border:'none', borderRadius:'6px', fontSize:'14px', fontWeight:500, cursor:drawerSaving?'not-allowed':'pointer', opacity:drawerSaving||!drawerStaff.first_name||!drawerStaff.last_name?0.5:1, fontFamily:'sans-serif' }}>
                  {drawerSaving ? 'Saving...' : drawerMode === 'add' ? 'Add employee' : 'Save changes'}
                </button>
                <button onClick={() => setDrawerMode(null)}
                  style={{ padding:'10px 16px', background:'transparent', color:'#9a9590', border:'1px solid #e8e4dc', borderRadius:'6px', fontSize:'14px', cursor:'pointer', fontFamily:'sans-serif' }}>
                  Cancel
                </button>
              </div>

              {drawerMode === 'edit' && (
                <div style={{ borderTop:'1px solid #f0ede6', paddingTop:'16px' }}>
                  <div style={{ fontSize:'11px', color:'#9a9590', marginBottom:'8px', textTransform:'uppercase' as any, letterSpacing:'0.06em', fontWeight:500 }}>Danger zone</div>
                  <button onClick={async () => {
                    if (!editingId) return
                    const s = staff.find(s => s.id === editingId)
                    if (!s) return
                    await toggleStaffActive(editingId, s.is_active)
                    setDrawerMode(null)
                  }}
                    style={{ width:'100%', padding:'8px', background:'transparent', color:'#8c2820', border:'1px solid #8c282044', borderRadius:'6px', fontSize:'13px', cursor:'pointer', fontFamily:'sans-serif' }}>
                    {staff.find(s => s.id === editingId)?.is_active ? 'Deactivate employee' : 'Reactivate employee'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
