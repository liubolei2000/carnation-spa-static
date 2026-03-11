'use client'
// src/app/admin/calendar/page.tsx — Monthly calendar + Day view
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Appt {
  id: string; customerName: string; appointmentAt: string; endsAt: string
  status: string; source: string
  service:   { name: string; durationMin: number; price: string }
  therapist: { name: string }
}

const DOW_ZH = ['日','一','二','三','四','五','六']
const DOW_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const STATUS_COLOR: Record<string,{bg:string;color:string;dot:string}> = {
  CONFIRMED: { bg:'rgba(109,191,142,0.18)', color:'#6dbf8e', dot:'#6dbf8e' },
  PENDING:   { bg:'rgba(167,139,250,0.18)', color:'#a78bfa', dot:'#a78bfa' },
  COMPLETED: { bg:'rgba(96,165,250,0.15)',  color:'#60a5fa', dot:'#60a5fa' },
  CANCELLED: { bg:'rgba(248,113,113,0.12)', color:'#f87171', dot:'#f87171' },
  NO_SHOW:   { bg:'rgba(148,163,184,0.15)', color:'#94a3b8', dot:'#94a3b8' },
}
const STATUS_DOT: Record<string,string> = { CONFIRMED:'#6dbf8e', PENDING:'#a78bfa', COMPLETED:'#60a5fa', CANCELLED:'#f87171', NO_SHOW:'#94a3b8' }

export default function CalendarPage() {
  const router = useRouter()
  const today = new Date()
  const [year, setYear]         = useState(today.getFullYear())
  const [month, setMonth]       = useState(today.getMonth())
  const [selectedDate, setSel]  = useState<string>(today.toISOString().split('T')[0])
  const [dayAppts, setDayAppts] = useState<Appt[]>([])
  const [monthData, setMonthData] = useState<Record<string, Appt[]>>({})
  const [loadingDay, setLoadingDay] = useState(false)
  const [modal, setModal]       = useState<Appt | null>(null)
  const [view, setView]         = useState<'month'|'day'>('month')
  const [lang, setLang]         = useState<'zh'|'en'>('zh')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setView('day')
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone:'America/New_York', hour:'numeric', minute:'2-digit', hour12:true })
  const fmtFull = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone:'America/New_York', month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', hour12:true })

  // Load whole month appointments for dots
  const loadMonth = useCallback(async () => {
    const promises = ['PENDING','CONFIRMED','COMPLETED'].map(s =>
      fetch(`/api/appointments?status=${s}`).then(r => r.json()).catch(() => [])
    )
    const [pending, confirmed, completed] = await Promise.all(promises)
    const all: Appt[] = [...(Array.isArray(pending)?pending:[]), ...(Array.isArray(confirmed)?confirmed:[]), ...(Array.isArray(completed)?completed:[])]
    const byDay: Record<string, Appt[]> = {}
    all.forEach(a => {
      const d = a.appointmentAt.split('T')[0]
      if (!byDay[d]) byDay[d] = []
      byDay[d].push(a)
    })
    setMonthData(byDay)
  }, [year, month])

  useEffect(() => { loadMonth() }, [loadMonth])

  const loadDay = useCallback(async (dateStr: string) => {
    setLoadingDay(true)
    const res = await fetch(`/api/appointments?date=${dateStr}`)
    const data = await res.json()
    setDayAppts(Array.isArray(data) ? data : [])
    setLoadingDay(false)
  }, [])

  useEffect(() => {
    if (view === 'day') loadDay(selectedDate)
  }, [selectedDate, view])

  function selectDate(d: string) {
    setSel(d)
    setView('day')
    loadDay(d)
  }

  function changeMonth(dir: number) {
    const d = new Date(year, month + dir, 1)
    setYear(d.getFullYear()); setMonth(d.getMonth())
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/appointments/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setDayAppts(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    setModal(m => m?.id === id ? { ...m, status } : m)
    loadMonth()
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(i)
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = lang === 'zh'
    ? `${year}年 ${month + 1}月`
    : `${MONTHS_EN[month]} ${year}`

  const selectedLabel = lang === 'zh'
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('zh-CN', { month:'long', day:'numeric', weekday:'long' })
    : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', weekday:'long' })

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:600 }}>{lang==='zh'?'预约日历':'Appointment Calendar'}</h1>
          <div style={{ fontSize:'0.82rem', color:'#7a8ba8', marginTop:'0.2rem' }}>{lang==='zh'?'查看和管理每日预约':'View and manage daily appointments'}</div>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          <div style={{ display:'flex', gap:'0.3rem' }}>
            {(['zh','en'] as const).map(l => (
              <button key={l} onClick={()=>setLang(l)} style={{ padding:'0.2rem 0.5rem', borderRadius:10, border:`1px solid ${lang===l?'#e8b86d':'#2a3045'}`, background:lang===l?'#e8b86d':'transparent', color:lang===l?'#0f1117':'#7a8ba8', fontSize:'0.6rem', fontFamily:'monospace', cursor:'pointer' }}>{l.toUpperCase()}</button>
            ))}
          </div>
          {!isMobile && (['month','day'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding:'0.4rem 0.9rem', borderRadius:6, border:`1px solid ${view===v?'#e8b86d':'#2a3045'}`, background:view===v?'rgba(232,184,109,0.1)':'transparent', color:view===v?'#e8b86d':'#7a8ba8', fontSize:'0.78rem', cursor:'pointer' }}>
              {v==='month' ? (lang==='zh'?'月历':'Month') : (lang==='zh'?'日视图':'Day')}
            </button>
          ))}
          <button onClick={() => router.push('/admin/appointments/new')}
            style={{ padding:'0.45rem 0.9rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
            ＋ {lang==='zh'?'录入':'New'}
          </button>
        </div>
      </div>

      {/* ── MONTH VIEW ── */}
      {view === 'month' && (
        <div style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem 1.2rem', borderBottom:'1px solid #2a3045' }}>
            <button onClick={() => changeMonth(-1)} style={{ padding:'0.3rem 0.7rem', background:'transparent', border:'1px solid #2a3045', borderRadius:5, color:'#7a8ba8', cursor:'pointer' }}>‹</button>
            <span style={{ fontWeight:600, fontSize:'1rem' }}>{monthLabel}</span>
            <button onClick={() => changeMonth(1)} style={{ padding:'0.3rem 0.7rem', background:'transparent', border:'1px solid #2a3045', borderRadius:5, color:'#7a8ba8', cursor:'pointer' }}>›</button>
          </div>

          {/* DOW headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid #2a3045' }}>
            {(lang==='zh'?DOW_ZH:DOW_EN).map(d => (
              <div key={d} style={{ padding:'0.5rem', textAlign:'center', fontFamily:'monospace', fontSize:'0.65rem', color:'#7a8ba8', letterSpacing:'0.1em', textTransform:'uppercase' }}>{d}</div>
            ))}
          </div>

          {/* Calendar cells */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} style={{ borderRight:'1px solid rgba(42,48,69,0.3)', borderBottom:'1px solid rgba(42,48,69,0.3)', minHeight: isMobile ? 44 : 80 }} />
              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const isToday = dateStr === today.toISOString().split('T')[0]
              const isSel   = dateStr === selectedDate
              const appts   = monthData[dateStr] ?? []
              const statusCounts: Record<string,number> = {}
              appts.forEach(a => { statusCounts[a.status] = (statusCounts[a.status]??0) + 1 })
              return (
                <div key={i} onClick={() => selectDate(dateStr)}
                  style={{ borderRight:'1px solid rgba(42,48,69,0.3)', borderBottom:'1px solid rgba(42,48,69,0.3)', minHeight: isMobile ? 44 : 80, padding: isMobile ? '0.3rem 0.25rem' : '0.4rem 0.5rem', cursor:'pointer', background: isSel?'rgba(232,184,109,0.08)':isToday?'rgba(42,48,69,0.4)':'transparent', transition:'background 0.15s' }}>
                  <div style={{ fontSize: isMobile ? '0.75rem' : '0.8rem', fontWeight: isToday?700:400, color: isToday?'#e8b86d':isSel?'#e8b86d':'#e2e8f0', marginBottom:'0.25rem', width: isMobile ? 20 : 22, height: isMobile ? 20 : 22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background: isToday?'rgba(232,184,109,0.15)':'transparent' }}>
                    {day}
                  </div>
                  {!isMobile && (
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.15rem' }}>
                      {appts.slice(0,3).map((a,ai) => (
                        <div key={ai} style={{ fontSize:'0.6rem', padding:'0.1rem 0.3rem', borderRadius:3, background:STATUS_COLOR[a.status]?.bg??'rgba(42,48,69,0.5)', color:STATUS_COLOR[a.status]?.color??'#7a8ba8', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', lineHeight:1.4 }}>
                          {fmt(a.appointmentAt).replace(' AM','a').replace(' PM','p')} {a.therapist.name.split(' ')[0]}
                        </div>
                      ))}
                      {appts.length > 3 && <div style={{ fontSize:'0.6rem', color:'#7a8ba8' }}>+{appts.length-3} more</div>}
                    </div>
                  )}
                  {isMobile && appts.length > 0 && (
                    <div style={{ display:'flex', gap:'2px', flexWrap:'wrap' }}>
                      {appts.slice(0,3).map((a,ai) => (
                        <div key={ai} style={{ width:5, height:5, borderRadius:'50%', background:STATUS_DOT[a.status]??'#7a8ba8' }}/>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── DAY VIEW ── */}
      {view === 'day' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
            <div style={{ fontSize:'0.95rem', fontWeight:500 }}>{selectedLabel}</div>
            <div style={{ display:'flex', gap:'0.5rem' }}>
              {[-1,1].map(dir => (
                <button key={dir} onClick={() => {
                  const d = new Date(selectedDate + 'T12:00:00')
                  d.setDate(d.getDate() + dir)
                  setSel(d.toISOString().split('T')[0])
                }}
                  style={{ padding:'0.3rem 0.7rem', background:'transparent', border:'1px solid #2a3045', borderRadius:5, color:'#7a8ba8', cursor:'pointer' }}>
                  {dir<0?'‹':'›'}
                </button>
              ))}
            </div>
          </div>

          {loadingDay ? (
            <div style={{ color:'#7a8ba8', fontSize:'0.85rem' }}>{lang==='zh'?'加载中…':'Loading…'}</div>
          ) : dayAppts.length === 0 ? (
            <div style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, padding:'3rem', textAlign:'center' }}>
              <div style={{ fontSize:'2rem', marginBottom:'0.8rem' }}>☕</div>
              <div style={{ color:'#7a8ba8', fontSize:'0.85rem' }}>{lang==='zh'?'当日暂无预约':'No appointments this day'}</div>
              <button onClick={() => router.push('/admin/appointments/new')}
                style={{ marginTop:'1rem', padding:'0.5rem 1.2rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
                ＋ {lang==='zh'?'录入预约':'New Booking'}
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {dayAppts.map(a => {
                const st = STATUS_COLOR[a.status] ?? STATUS_COLOR.PENDING
                return (
                  <div key={a.id} style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, padding:'1rem 1.2rem', display:'flex', gap:'1rem', alignItems:'flex-start', borderLeft:`3px solid ${st.dot}` }}>
                    <div style={{ textAlign:'center', flexShrink:0, minWidth:70 }}>
                      <div style={{ fontFamily:'monospace', fontSize:'0.82rem', fontWeight:600, color:'#e8b86d' }}>{fmt(a.appointmentAt)}</div>
                      <div style={{ fontFamily:'monospace', fontSize:'0.65rem', color:'#7a8ba8' }}>{a.service.durationMin}min</div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', alignItems:'center', marginBottom:'0.3rem' }}>
                        <span style={{ fontWeight:500, fontSize:'0.9rem' }}>{a.customerName}</span>
                        <span style={{ fontSize:'0.78rem', color:'#94a3b8' }}>{a.service.name}</span>
                        <span style={{ fontSize:'0.78rem', color:'#7a8ba8' }}>🧘 {a.therapist.name}</span>
                      </div>
                      <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', padding:'0.18rem 0.55rem', borderRadius:20, background:st.bg, color:st.color, fontFamily:'monospace', fontSize:'0.62rem', fontWeight:500 }}>
                          <span style={{ width:5, height:5, borderRadius:'50%', background:st.dot }}/>
                          {a.status}
                        </span>
                        <span style={{ fontFamily:'monospace', fontSize:'0.62rem', color:'#e8b86d' }}>${Number(a.service.price).toFixed(0)}</span>
                      </div>
                    </div>
                    <button onClick={() => setModal(a)} style={{ padding:'0.3rem 0.7rem', background:'transparent', border:'1px solid #2a3045', borderRadius:5, color:'#7a8ba8', fontSize:'0.75rem', cursor:'pointer', flexShrink:0 }}>
                      {lang==='zh'?'详情':'View'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#161b27', border:'1px solid #2a3045', borderRadius: isMobile ? '12px 12px 0 0' : 12, width: isMobile ? '100%' : 'min(480px,94vw)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
            <div style={{ padding:'1.2rem 1.4rem', borderBottom:'1px solid #2a3045', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:600 }}>{lang==='zh'?'预约详情':'Appointment'}</span>
              <button onClick={() => setModal(null)} style={{ width:28, height:28, borderRadius:'50%', background:'#1c2333', border:'1px solid #2a3045', color:'#7a8ba8', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:'1.4rem' }}>
              <div style={{ fontWeight:500, fontSize:'1rem', marginBottom:'0.25rem' }}>{modal.customerName}</div>
              <div style={{ fontSize:'0.82rem', color:'#7a8ba8', marginBottom:'1rem' }}>{modal.service.name} · {modal.therapist.name}</div>
              {[
                [lang==='zh'?'时间':'Time', fmtFull(modal.appointmentAt)],
                [lang==='zh'?'时长':'Duration', `${modal.service.durationMin} min`],
                [lang==='zh'?'价格':'Price', `$${Number(modal.service.price).toFixed(0)}`],
              ].map(([k,v]) => (
                <div key={k as string} style={{ display:'flex', justifyContent:'space-between', padding:'0.4rem 0', borderBottom:'1px solid rgba(42,48,69,0.5)', fontSize:'0.85rem' }}>
                  <span style={{ color:'#7a8ba8' }}>{k}</span><span>{v}</span>
                </div>
              ))}
              <div style={{ display:'flex', gap:'0.6rem', marginTop:'1.2rem', flexWrap:'wrap' }}>
                {modal.status === 'PENDING' && (
                  <button onClick={() => updateStatus(modal.id,'CONFIRMED')} style={{ flex:1, padding:'0.6rem', background:'rgba(109,191,142,0.15)', border:'1px solid rgba(109,191,142,0.3)', borderRadius:6, color:'#6dbf8e', fontSize:'0.82rem', cursor:'pointer' }}>
                    ✓ {lang==='zh'?'确认':'Confirm'}
                  </button>
                )}
                {['PENDING','CONFIRMED'].includes(modal.status) && (
                  <button onClick={() => updateStatus(modal.id,'COMPLETED')} style={{ flex:1, padding:'0.6rem', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.25)', borderRadius:6, color:'#60a5fa', fontSize:'0.82rem', cursor:'pointer' }}>
                    {lang==='zh'?'完成':'Complete'}
                  </button>
                )}
                {!['CANCELLED','COMPLETED'].includes(modal.status) && (
                  <button onClick={() => updateStatus(modal.id,'CANCELLED')} style={{ flex:1, padding:'0.6rem', background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:6, color:'#f87171', fontSize:'0.82rem', cursor:'pointer' }}>
                    {lang==='zh'?'取消':'Cancel'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
