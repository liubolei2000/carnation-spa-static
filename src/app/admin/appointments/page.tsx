'use client'
// src/app/admin/appointments/page.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Appt {
  id: string; customerName: string; customerPhone: string
  appointmentAt: string; status: string; source: string; notes: string | null
  service:   { name: string; durationMin: number; price: string }
  therapist: { name: string }
}

const STATUSES = ['ALL','PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW']
const STATUS_COLORS: Record<string,{bg:string;color:string;dot:string}> = {
  CONFIRMED: { bg:'rgba(109,191,142,0.15)', color:'#6dbf8e', dot:'#6dbf8e' },
  PENDING:   { bg:'rgba(232,184,109,0.15)', color:'#e8b86d', dot:'#e8b86d' },
  CANCELLED: { bg:'rgba(248,113,113,0.15)', color:'#f87171', dot:'#f87171' },
  COMPLETED: { bg:'rgba(96,165,250,0.15)',  color:'#60a5fa', dot:'#60a5fa' },
  NO_SHOW:   { bg:'rgba(148,163,184,0.15)', color:'#94a3b8', dot:'#94a3b8' },
}
const STATUS_ZH: Record<string,string> = {
  ALL:'全部', CONFIRMED:'已确认', PENDING:'待确认', CANCELLED:'已取消', COMPLETED:'已完成', NO_SHOW:'未到场'
}

export default function AppointmentsPage() {
  const router = useRouter()
  const [appts, setAppts]         = useState<Appt[]>([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatus] = useState('ALL')
  const [search, setSearch]       = useState('')
  const [dateFilter, setDate]     = useState('')
  const [modal, setModal]         = useState<Appt | null>(null)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [updating, setUpdating]   = useState(false)
  const [toast, setToast]         = useState('')
  const [lang, setLang]           = useState<'zh'|'en'>('zh')
  const [isMobile, setIsMobile]   = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  async function load() {
    setLoading(true)
    const p = new URLSearchParams()
    if (statusFilter !== 'ALL') p.set('status', statusFilter)
    if (dateFilter) p.set('date', dateFilter)
    const res = await fetch('/api/appointments?' + p)
    const data = await res.json()
    setAppts(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [statusFilter, dateFilter])

  async function updateStatus(id: string, status: string) {
    setUpdating(true)
    const res = await fetch(`/api/appointments/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setUpdating(false)
    if (res.ok) {
      setAppts(prev => prev.map(a => a.id === id ? { ...a, status } : a))
      setModal(m => m?.id === id ? { ...m, status } : m)
      showToast(lang==='zh'?`已更新为 ${STATUS_ZH[status]??status}`:`Status: ${status}`)
    }
    return res.ok
  }

  const filtered = appts.filter(a =>
    !search ||
    a.customerName.toLowerCase().includes(search.toLowerCase()) ||
    a.customerPhone.includes(search) ||
    a.service.name.toLowerCase().includes(search.toLowerCase()) ||
    a.therapist.name.toLowerCase().includes(search.toLowerCase())
  )

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', {
    timeZone:'America/New_York', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true
  })
  const fmtFull = (iso: string) => new Date(iso).toLocaleString('en-US', {
    timeZone:'America/New_York', month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', hour12:true
  })

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.5rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:600 }}>{lang==='zh'?'预约列表':'All Appointments'}</h1>
          <div style={{ fontSize:'0.82rem', color:'#7a8ba8', marginTop:'0.2rem' }}>{lang==='zh'?`共 ${filtered.length} 条记录`:`${filtered.length} appointments`}</div>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          <div style={{ display:'flex', gap:'0.3rem' }}>
            {(['zh','en'] as const).map(l => (
              <button key={l} onClick={()=>setLang(l)} style={{ padding:'0.2rem 0.5rem', borderRadius:10, border:`1px solid ${lang===l?'#e8b86d':'#2a3045'}`, background:lang===l?'#e8b86d':'transparent', color:lang===l?'#0f1117':'#7a8ba8', fontSize:'0.6rem', fontFamily:'monospace', cursor:'pointer' }}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={() => router.push('/admin/appointments/new')}
            style={{ padding:'0.5rem 1rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
            ＋ {lang==='zh'?'录入':'New'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, overflow:'hidden', marginBottom:'1rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.75rem 1rem', flexWrap:'wrap', borderBottom:'1px solid #2a3045' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang==='zh'?'搜索姓名/电话/项目/技师…':'Search name, phone, service…'}
            style={{ flex:1, minWidth:140, padding:'0.5rem 0.8rem', background:'#161b27', border:'1px solid #2a3045', borderRadius:6, color:'#e2e8f0', fontSize:'0.83rem', outline:'none' }} />
          <input type="date" value={dateFilter} onChange={e => setDate(e.target.value)}
            style={{ padding:'0.5rem 0.6rem', background:'#161b27', border:'1px solid #2a3045', borderRadius:6, color:'#e2e8f0', fontSize:'0.83rem', outline:'none', minWidth:0 }} />
          <select value={statusFilter} onChange={e => setStatus(e.target.value)}
            style={{ padding:'0.5rem 0.6rem', background:'#161b27', border:'1px solid #2a3045', borderRadius:6, color:'#94a3b8', fontSize:'0.8rem', outline:'none' }}>
            {STATUSES.map(s => <option key={s} value={s}>{lang==='zh'?STATUS_ZH[s]:s}</option>)}
          </select>
          {dateFilter && (
            <button onClick={() => setDate('')} style={{ padding:'0.5rem 0.7rem', background:'transparent', border:'1px solid #2a3045', borderRadius:6, color:'#7a8ba8', fontSize:'0.75rem', cursor:'pointer' }}>✕</button>
          )}
        </div>

        {loading ? (
          <div style={{ padding:'2rem', textAlign:'center', color:'#7a8ba8' }}>{lang==='zh'?'加载中…':'Loading…'}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'#7a8ba8', fontSize:'0.85rem' }}>{lang==='zh'?'暂无记录':'No appointments found'}</div>
        ) : isMobile ? (
          /* ── Mobile card list ── */
          <div style={{ display:'flex', flexDirection:'column' }}>
            {filtered.map((a, i) => {
              const st = STATUS_COLORS[a.status] ?? STATUS_COLORS.PENDING
              const dateStr = new Date(a.appointmentAt).toLocaleString('en-US', { timeZone:'America/New_York', month:'short', day:'numeric' })
              const timeStr = new Date(a.appointmentAt).toLocaleTimeString('en-US', { timeZone:'America/New_York', hour:'numeric', minute:'2-digit', hour12:true })
              return (
                <div key={a.id}
                  style={{ padding:'0.9rem 1rem', borderBottom: i < filtered.length-1 ? '1px solid rgba(42,48,69,0.5)' : 'none', display:'flex', gap:'0.75rem', alignItems:'flex-start', cursor:'pointer' }}
                  onClick={() => setModal(a)}>
                  {/* Date/time */}
                  <div style={{ flexShrink:0, textAlign:'center', minWidth:48 }}>
                    <div style={{ fontFamily:'monospace', fontSize:'0.7rem', color:'#7a8ba8', lineHeight:1.2 }}>{dateStr}</div>
                    <div style={{ fontFamily:'monospace', fontSize:'0.78rem', fontWeight:600, color:'#e8b86d', lineHeight:1.4 }}>{timeStr}</div>
                  </div>
                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'0.87rem', fontWeight:500, marginBottom:'0.2rem' }}>{a.customerName}</div>
                    <div style={{ fontSize:'0.77rem', color:'#94a3b8', marginBottom:'0.3rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {a.service.name} · {a.therapist.name}
                    </div>
                    <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', padding:'0.12rem 0.5rem', borderRadius:20, background:st.bg, color:st.color, fontFamily:'monospace', fontSize:'0.6rem', fontWeight:500 }}>
                        <span style={{ width:4, height:4, borderRadius:'50%', background:st.dot }}/>
                        {lang==='zh'?(STATUS_ZH[a.status]??a.status):a.status}
                      </span>
                      <span style={{ fontFamily:'monospace', fontSize:'0.62rem', color: a.source==='ONLINE'?'#a78bfa':'#60a5fa' }}>
                        {a.source==='ONLINE'?(lang==='zh'?'在线':'Online'):(lang==='zh'?'电话':'Manual')}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize:'0.75rem', color:'#3d4f6e', flexShrink:0, marginTop:'0.2rem' }}>›</span>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── Desktop table ── */
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
              <thead>
                <tr style={{ background:'#161b27', borderBottom:'1px solid #2a3045' }}>
                  {(lang==='zh'
                    ? ['日期时间','客户','电话','项目','技师','状态','来源','']
                    : ['Date & Time','Customer','Phone','Service','Therapist','Status','Source','']).map(h => (
                    <th key={h} style={{ padding:'0.7rem 1rem', textAlign:'left', fontFamily:'monospace', fontSize:'0.62rem', letterSpacing:'0.1em', textTransform:'uppercase', color:'#7a8ba8', fontWeight:400, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const st = STATUS_COLORS[a.status] ?? STATUS_COLORS.PENDING
                  const isOpen = expanded === a.id
                  return (
                    <>
                      <tr key={a.id} style={{ borderBottom: isOpen ? 'none' : '1px solid rgba(42,48,69,0.5)', cursor:'pointer', transition:'background 0.1s', background: isOpen ? 'rgba(42,48,69,0.4)' : 'transparent' }}
                        onClick={() => setExpanded(isOpen ? null : a.id)}
                        onMouseEnter={e=>{ if(!isOpen) e.currentTarget.style.background='rgba(42,48,69,0.3)' }}
                        onMouseLeave={e=>{ if(!isOpen) e.currentTarget.style.background='transparent' }}>
                        <td style={{ padding:'0.8rem 1rem', fontFamily:'monospace', fontSize:'0.78rem', whiteSpace:'nowrap' }}>{fmt(a.appointmentAt)}</td>
                        <td style={{ padding:'0.8rem 1rem', fontSize:'0.85rem', whiteSpace:'nowrap' }}>{a.customerName}</td>
                        <td style={{ padding:'0.8rem 1rem', fontFamily:'monospace', fontSize:'0.75rem', color:'#7a8ba8' }}>
                          {a.customerPhone.replace(/(\+\d{1,2})\d+(\d{4})$/,'$1****$2')}
                        </td>
                        <td style={{ padding:'0.8rem 1rem', fontSize:'0.82rem', color:'#94a3b8', whiteSpace:'nowrap' }}>{a.service.name}</td>
                        <td style={{ padding:'0.8rem 1rem', fontSize:'0.82rem', whiteSpace:'nowrap' }}>{a.therapist.name}</td>
                        <td style={{ padding:'0.8rem 1rem' }}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:'0.35rem', padding:'0.18rem 0.6rem', borderRadius:20, background:st.bg, color:st.color, fontFamily:'monospace', fontSize:'0.62rem', fontWeight:500 }}>
                            <span style={{ width:5, height:5, borderRadius:'50%', background:st.dot }}/>
                            {lang==='zh'?(STATUS_ZH[a.status]??a.status):a.status}
                          </span>
                        </td>
                        <td style={{ padding:'0.8rem 1rem' }}>
                          <span style={{ padding:'0.12rem 0.5rem', borderRadius:4, fontFamily:'monospace', fontSize:'0.62rem', background:a.source==='ONLINE'?'rgba(167,139,250,0.15)':'rgba(96,165,250,0.15)', color:a.source==='ONLINE'?'#a78bfa':'#60a5fa' }}>
                            {a.source==='ONLINE'?(lang==='zh'?'在线':'Online'):(lang==='zh'?'电话':'Manual')}
                          </span>
                        </td>
                        <td style={{ padding:'0.8rem 1rem', textAlign:'right', color:'#3d4f6e', fontSize:'0.75rem' }}>
                          {isOpen ? '▲' : '▼'}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={a.id + '-expand'} style={{ borderBottom:'1px solid rgba(42,48,69,0.5)' }}>
                          <td colSpan={8} style={{ padding:'0 1rem 1rem', background:'rgba(42,48,69,0.2)' }}>
                            <div style={{ display:'flex', gap:'2rem', flexWrap:'wrap', paddingTop:'0.75rem', alignItems:'flex-start' }}>
                              <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', fontSize:'0.82rem', minWidth:200 }}>
                                {a.notes && <div style={{ color:'#94a3b8', padding:'0.4rem 0.6rem', background:'rgba(42,48,69,0.4)', borderRadius:4 }}>📝 {a.notes}</div>}
                                <div style={{ color:'#7a8ba8' }}>{lang==='zh'?'时长':'Duration'}: <span style={{ color:'#e2e8f0' }}>{a.service.durationMin} min</span></div>
                                <div style={{ color:'#7a8ba8' }}>{lang==='zh'?'价格':'Price'}: <span style={{ color:'#e2e8f0' }}>${Number(a.service.price).toFixed(0)}</span></div>
                                <div style={{ color:'#7a8ba8' }}>{lang==='zh'?'完整时间':'Full time'}: <span style={{ color:'#e2e8f0' }}>{fmtFull(a.appointmentAt)}</span></div>
                              </div>
                              <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center' }}>
                                {a.status === 'PENDING' && (
                                  <button onClick={e=>{ e.stopPropagation(); updateStatus(a.id,'CONFIRMED').then(()=>setExpanded(null)) }} disabled={updating}
                                    style={{ padding:'0.5rem 1rem', background:'rgba(109,191,142,0.15)', border:'1px solid rgba(109,191,142,0.3)', borderRadius:6, color:'#6dbf8e', fontSize:'0.8rem', cursor:'pointer' }}>
                                    ✓ {lang==='zh'?'确认':'Confirm'}
                                  </button>
                                )}
                                {['PENDING','CONFIRMED'].includes(a.status) && (
                                  <button onClick={e=>{ e.stopPropagation(); updateStatus(a.id,'COMPLETED').then(()=>setExpanded(null)) }} disabled={updating}
                                    style={{ padding:'0.5rem 1rem', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.25)', borderRadius:6, color:'#60a5fa', fontSize:'0.8rem', cursor:'pointer' }}>
                                    {lang==='zh'?'完成':'Complete'}
                                  </button>
                                )}
                                {['PENDING','CONFIRMED'].includes(a.status) && (
                                  <button onClick={e=>{ e.stopPropagation(); updateStatus(a.id,'NO_SHOW').then(()=>setExpanded(null)) }} disabled={updating}
                                    style={{ padding:'0.5rem 1rem', background:'rgba(148,163,184,0.1)', border:'1px solid rgba(148,163,184,0.25)', borderRadius:6, color:'#94a3b8', fontSize:'0.8rem', cursor:'pointer' }}>
                                    {lang==='zh'?'未到':'No Show'}
                                  </button>
                                )}
                                {!['CANCELLED','COMPLETED'].includes(a.status) && (
                                  <button onClick={e=>{ e.stopPropagation(); updateStatus(a.id,'CANCELLED').then(()=>setExpanded(null)) }} disabled={updating}
                                    style={{ padding:'0.5rem 1rem', background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:6, color:'#f87171', fontSize:'0.8rem', cursor:'pointer' }}>
                                    {lang==='zh'?'取消':'Cancel'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#161b27', border:'1px solid #2a3045', borderRadius: isMobile ? '12px 12px 0 0' : 12, width: isMobile ? '100%' : 'min(500px,94vw)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)', maxHeight:'90vh', overflow:'auto' }}>
            <div style={{ padding:'1.2rem 1.4rem', borderBottom:'1px solid #2a3045', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#161b27' }}>
              <span style={{ fontWeight:600 }}>{lang==='zh'?'预约详情':'Appointment Details'}</span>
              <button onClick={() => setModal(null)} style={{ width:28, height:28, borderRadius:'50%', background:'#1c2333', border:'1px solid #2a3045', color:'#7a8ba8', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:'1.4rem' }}>
              <div style={{ display:'flex', gap:'1rem', alignItems:'center', marginBottom:'1.2rem', paddingBottom:'1.2rem', borderBottom:'1px solid #2a3045' }}>
                <div style={{ width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg,#e8b86d,#a78bfa)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', flexShrink:0 }}>👤</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500, fontSize:'1rem' }}>{modal.customerName}</div>
                  <div style={{ fontFamily:'monospace', fontSize:'0.72rem', color:'#7a8ba8' }}>
                    {modal.customerPhone.replace(/(\+\d{1,2})\d+(\d{4})$/,'$1****$2')}
                  </div>
                </div>
                <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', padding:'0.18rem 0.6rem', borderRadius:20, background:STATUS_COLORS[modal.status]?.bg, color:STATUS_COLORS[modal.status]?.color, fontFamily:'monospace', fontSize:'0.65rem', fontWeight:500, flexShrink:0 }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', background:STATUS_COLORS[modal.status]?.dot }}/>
                  {lang==='zh'?(STATUS_ZH[modal.status]??modal.status):modal.status}
                </span>
              </div>
              {[
                [lang==='zh'?'项目':'Service', modal.service.name],
                [lang==='zh'?'时长':'Duration', `${modal.service.durationMin} min`],
                [lang==='zh'?'价格':'Price', `$${Number(modal.service.price).toFixed(0)}`],
                [lang==='zh'?'技师':'Therapist', modal.therapist.name],
                [lang==='zh'?'时间':'Time', fmtFull(modal.appointmentAt)],
                [lang==='zh'?'来源':'Source', modal.source==='ONLINE'?(lang==='zh'?'在线预约':'Online'):(lang==='zh'?'电话录入':'Manual Entry')],
              ].map(([k,v]) => (
                <div key={k as string} style={{ display:'flex', justifyContent:'space-between', padding:'0.5rem 0', borderBottom:'1px solid rgba(42,48,69,0.5)', fontSize:'0.85rem' }}>
                  <span style={{ color:'#7a8ba8' }}>{k}</span><span style={{ textAlign:'right', maxWidth:'60%' }}>{v}</span>
                </div>
              ))}
              {modal.notes && (
                <div style={{ marginTop:'0.75rem', padding:'0.6rem 0.8rem', background:'rgba(42,48,69,0.3)', borderRadius:6, fontSize:'0.82rem', color:'#94a3b8', lineHeight:1.6 }}>
                  📝 {modal.notes}
                </div>
              )}
              <div style={{ display:'flex', gap:'0.6rem', marginTop:'1.2rem', flexWrap:'wrap' }}>
                {modal.status === 'PENDING' && (
                  <button onClick={() => updateStatus(modal.id,'CONFIRMED')} disabled={updating}
                    style={{ flex:1, padding:'0.65rem', background:'rgba(109,191,142,0.15)', border:'1px solid rgba(109,191,142,0.3)', borderRadius:6, color:'#6dbf8e', fontSize:'0.82rem', cursor:'pointer', minWidth:80 }}>
                    ✓ {lang==='zh'?'确认':'Confirm'}
                  </button>
                )}
                {['PENDING','CONFIRMED'].includes(modal.status) && (
                  <button onClick={() => updateStatus(modal.id,'COMPLETED')} disabled={updating}
                    style={{ flex:1, padding:'0.65rem', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.25)', borderRadius:6, color:'#60a5fa', fontSize:'0.82rem', cursor:'pointer', minWidth:80 }}>
                    {lang==='zh'?'完成':'Complete'}
                  </button>
                )}
                {['PENDING','CONFIRMED'].includes(modal.status) && (
                  <button onClick={() => updateStatus(modal.id,'NO_SHOW')} disabled={updating}
                    style={{ flex:1, padding:'0.65rem', background:'rgba(148,163,184,0.1)', border:'1px solid rgba(148,163,184,0.25)', borderRadius:6, color:'#94a3b8', fontSize:'0.82rem', cursor:'pointer', minWidth:80 }}>
                    {lang==='zh'?'未到':'No Show'}
                  </button>
                )}
                {!['CANCELLED','COMPLETED'].includes(modal.status) && (
                  <button onClick={() => updateStatus(modal.id,'CANCELLED')} disabled={updating}
                    style={{ flex:1, padding:'0.65rem', background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:6, color:'#f87171', fontSize:'0.82rem', cursor:'pointer', minWidth:80 }}>
                    {lang==='zh'?'取消':'Cancel'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ position:'fixed', bottom:'1.5rem', right:'1.5rem', background:'#1c2333', border:'1px solid #2a3045', borderLeft:'3px solid #6dbf8e', borderRadius:6, padding:'0.75rem 1.2rem', fontSize:'0.82rem', transition:'all 0.3s', opacity:toast?1:0, transform:toast?'translateY(0)':'translateY(60px)', pointerEvents:'none', zIndex:600 }}>
        {toast}
      </div>
    </div>
  )
}
