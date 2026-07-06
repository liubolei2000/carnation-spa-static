'use client'
// src/app/admin/schedule/page.tsx — 技师专属日程
import { useEffect, useState } from 'react'
import { useAuth } from '../layout'

interface Appt {
  id: string; customerName: string; customerPhone: string
  appointmentAt: string; endsAt: string; status: string; notes: string | null
  service: { name: string; durationMin: number; price: string }
  therapist: { name: string }
}

const STATUS_C: Record<string,{bg:string;color:string;dot:string}> = {
  CONFIRMED: { bg:'rgba(109,191,142,0.15)', color:'#6dbf8e', dot:'#6dbf8e' },
  PENDING:   { bg:'rgba(232,184,109,0.15)', color:'#e8b86d', dot:'#e8b86d' },
  COMPLETED: { bg:'rgba(96,165,250,0.15)',  color:'#60a5fa', dot:'#60a5fa' },
  CANCELLED: { bg:'rgba(248,113,113,0.12)', color:'#f87171', dot:'#f87171' },
  NO_SHOW:   { bg:'rgba(148,163,184,0.12)', color:'#94a3b8', dot:'#94a3b8' },
}

function getWeekDates(anchor: string) {
  const d = new Date(anchor + 'T12:00:00')
  const day = d.getDay()
  return Array.from({length:7}, (_,i) => {
    const x = new Date(d); x.setDate(d.getDate() - day + i)
    return x.toLocaleDateString('en-CA')
  })
}

export default function SchedulePage() {
  const session = useAuth()
  const [appts, setAppts]     = useState<Appt[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate]       = useState(new Date().toLocaleDateString('en-CA'))
  const [view, setView]       = useState<'day'|'week'>('day')
  const [weekAppts, setWeekAppts] = useState<Record<string,Appt[]>>({})
  const [modal, setModal]     = useState<Appt|null>(null)

  const week = getWeekDates(date)

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone:'America/New_York', hour:'numeric', minute:'2-digit', hour12:true })
  const fmtDate = (iso: string) => new Date(iso+'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })

  useEffect(() => {
    if (view === 'day') {
      setLoading(true)
      fetch(`/api/appointments?date=${date}`)
        .then(r => r.json())
        .then(d => { setAppts(Array.isArray(d)?d:[]); setLoading(false) })
        .catch(() => setLoading(false))
    }
  }, [date, view])

  useEffect(() => {
    if (view === 'week') {
      setLoading(true)
      Promise.all(week.map(d => fetch(`/api/appointments?date=${d}`).then(r=>r.json()).catch(()=>[])))
        .then(results => {
          const map: Record<string,Appt[]> = {}
          week.forEach((d,i) => { map[d] = Array.isArray(results[i])?results[i]:[] })
          setWeekAppts(map); setLoading(false)
        })
    }
  }, [date, view])

  const today = new Date().toLocaleDateString('en-CA')
  const totalRevenue = appts.filter(a=>['CONFIRMED','COMPLETED'].includes(a.status)).reduce((s,a)=>s+Number(a.service.price),0)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:600 }}>我的日程</h1>
          <div style={{ fontSize:'0.82rem', color:'#7a8ba8', marginTop:'0.2rem' }}>
            {session?.name} · {new Date(date+'T12:00:00').toLocaleDateString('zh-CN', { month:'long', day:'numeric', weekday:'long' })}
          </div>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap' }}>
          {(['day','week'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding:'0.4rem 0.9rem', borderRadius:6, border:`1px solid ${view===v?'#e8b86d':'#2a3045'}`, background:view===v?'rgba(232,184,109,0.1)':'transparent', color:view===v?'#e8b86d':'#7a8ba8', fontSize:'0.78rem', cursor:'pointer' }}>
              {v==='day'?'日视图':'周视图'}
            </button>
          ))}
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding:'0.45rem 0.7rem', background:'#1c2333', border:'1px solid #2a3045', borderRadius:6, color:'#e2e8f0', fontSize:'0.83rem', outline:'none' }} />
          <button onClick={() => setDate(today)} style={{ padding:'0.45rem 0.9rem', background:'transparent', border:'1px solid #2a3045', borderRadius:6, color:'#7a8ba8', fontSize:'0.78rem', cursor:'pointer' }}>今天</button>
        </div>
      </div>

      {/* Day stats */}
      {view === 'day' && !loading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'0.75rem', marginBottom:'1.2rem' }}>
          {[
            { label:'当日预约', value:appts.length, color:'#e8b86d' },
            { label:'已确认', value:appts.filter(a=>a.status==='CONFIRMED').length, color:'#6dbf8e' },
            { label:'预估收入', value:`$${totalRevenue}`, color:'#60a5fa' },
          ].map(s => (
            <div key={s.label} style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, padding:'1rem', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${s.color},${s.color}88)` }}/>
              <div style={{ fontFamily:'monospace', fontSize:'0.62rem', color:'#7a8ba8', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'0.4rem' }}>{s.label}</div>
              <div style={{ fontSize:'1.6rem', fontWeight:600 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ color:'#7a8ba8', fontSize:'0.85rem' }}>加载中…</div>
      ) : view === 'day' ? (
        appts.length === 0 ? (
          <div style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, padding:'3rem', textAlign:'center' }}>
            <div style={{ fontSize:'2rem', marginBottom:'0.8rem' }}>☕</div>
            <div style={{ color:'#7a8ba8', fontSize:'0.85rem' }}>当日暂无预约</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            {appts.map(a => {
              const st = STATUS_C[a.status] ?? STATUS_C.PENDING
              return (
                <div key={a.id} onClick={() => setModal(a)} style={{ background:'#1c2333', border:'1px solid #2a3045', borderLeft:`3px solid ${st.dot}`, borderRadius:8, padding:'1rem 1.2rem', display:'flex', gap:'1rem', alignItems:'flex-start', cursor:'pointer', transition:'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background='rgba(42,48,69,0.5)')}
                  onMouseLeave={e => (e.currentTarget.style.background='#1c2333')}>
                  <div style={{ textAlign:'center', flexShrink:0, minWidth:68 }}>
                    <div style={{ fontFamily:'monospace', fontSize:'0.85rem', fontWeight:700, color:'#e8b86d' }}>{fmt(a.appointmentAt)}</div>
                    <div style={{ fontFamily:'monospace', fontSize:'0.65rem', color:'#7a8ba8' }}>{a.service.durationMin}min</div>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:500, fontSize:'0.92rem', marginBottom:'0.25rem' }}>{a.customerName}</div>
                    <div style={{ fontSize:'0.82rem', color:'#94a3b8', marginBottom:'0.35rem' }}>{a.service.name}</div>
                    {a.notes && <div style={{ fontSize:'0.75rem', color:'#7a8ba8', fontStyle:'italic' }}>📝 {a.notes}</div>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', alignItems:'flex-end', flexShrink:0 }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', padding:'0.18rem 0.55rem', borderRadius:20, background:st.bg, color:st.color, fontFamily:'monospace', fontSize:'0.62rem', fontWeight:500 }}>
                      <span style={{ width:5, height:5, borderRadius:'50%', background:st.dot }}/>
                      {a.status}
                    </span>
                    <span style={{ fontFamily:'monospace', fontSize:'0.72rem', color:'#e8b86d' }}>${Number(a.service.price).toFixed(0)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* Week view */
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'0.5rem' }}>
          {week.map(d => {
            const isToday = d === today
            const dAppts = weekAppts[d] ?? []
            return (
              <div key={d} style={{ background:'#1c2333', border:`1px solid ${isToday?'rgba(232,184,109,0.4)':'#2a3045'}`, borderRadius:8, overflow:'hidden', minHeight:160 }}>
                <div style={{ padding:'0.5rem 0.6rem', borderBottom:'1px solid #2a3045', background: isToday?'rgba(232,184,109,0.08)':'transparent', textAlign:'center' }}>
                  <div style={{ fontFamily:'monospace', fontSize:'0.6rem', color:isToday?'#e8b86d':'#7a8ba8', textTransform:'uppercase', letterSpacing:'0.1em' }}>
                    {new Date(d+'T12:00:00').toLocaleDateString('en-US', { weekday:'short' })}
                  </div>
                  <div style={{ fontSize:'1rem', fontWeight: isToday?700:400, color: isToday?'#e8b86d':'#e2e8f0' }}>
                    {new Date(d+'T12:00:00').getDate()}
                  </div>
                </div>
                <div style={{ padding:'0.4rem' }}>
                  {dAppts.length === 0 ? (
                    <div style={{ fontSize:'0.62rem', color:'rgba(122,139,168,0.4)', textAlign:'center', paddingTop:'0.5rem' }}>—</div>
                  ) : dAppts.map(a => {
                    const st = STATUS_C[a.status] ?? STATUS_C.PENDING
                    return (
                      <div key={a.id} onClick={() => { setDate(d); setView('day') }}
                        style={{ padding:'0.25rem 0.35rem', marginBottom:'0.25rem', borderRadius:4, background:st.bg, cursor:'pointer' }}>
                        <div style={{ fontFamily:'monospace', fontSize:'0.6rem', color:st.color }}>{fmt(a.appointmentAt).replace(' AM','a').replace(' PM','p')}</div>
                        <div style={{ fontSize:'0.65rem', color:'#e2e8f0', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{a.customerName.split(' ')[0]}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Appointment detail modal */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#161b27', border:'1px solid #2a3045', borderRadius:12, width:'min(440px,94vw)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
            <div style={{ padding:'1.2rem 1.4rem', borderBottom:'1px solid #2a3045', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:600 }}>预约详情</span>
              <button onClick={() => setModal(null)} style={{ width:28, height:28, borderRadius:'50%', background:'#1c2333', border:'1px solid #2a3045', color:'#7a8ba8', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:'1.4rem' }}>
              <div style={{ fontWeight:500, fontSize:'1rem', marginBottom:'0.3rem' }}>{modal.customerName}</div>
              {[
                ['项目', modal.service.name],
                ['时间', `${fmt(modal.appointmentAt)} — ${fmt(modal.endsAt)}`],
                ['时长', `${modal.service.durationMin} min`],
                ['状态', modal.status],
              ].map(([k,v]) => (
                <div key={k as string} style={{ display:'flex', justifyContent:'space-between', padding:'0.45rem 0', borderBottom:'1px solid rgba(42,48,69,0.5)', fontSize:'0.85rem' }}>
                  <span style={{ color:'#7a8ba8' }}>{k}</span><span>{v}</span>
                </div>
              ))}
              {modal.notes && (
                <div style={{ marginTop:'0.75rem', padding:'0.6rem 0.8rem', background:'rgba(42,48,69,0.3)', borderRadius:6, fontSize:'0.82rem', color:'#94a3b8' }}>
                  📝 {modal.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
