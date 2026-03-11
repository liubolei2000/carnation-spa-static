'use client'
// src/app/admin/dashboard/page.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Appointment {
  id: string; customerName: string; customerPhone: string
  appointmentAt: string; status: string; source: string; notes: string | null
  service: { name: string; price: string; durationMin: number }
  therapist: { name: string }
}

const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  CONFIRMED: { bg:'rgba(109,191,142,0.15)', color:'#6dbf8e', dot:'#6dbf8e' },
  PENDING:   { bg:'rgba(232,184,109,0.15)', color:'#e8b86d', dot:'#e8b86d' },
  CANCELLED: { bg:'rgba(248,113,113,0.15)', color:'#f87171', dot:'#f87171' },
  COMPLETED: { bg:'rgba(96,165,250,0.15)',  color:'#60a5fa', dot:'#60a5fa' },
  NO_SHOW:   { bg:'rgba(148,163,184,0.15)', color:'#94a3b8', dot:'#94a3b8' },
}

const STATUS_ZH: Record<string,string> = {
  CONFIRMED:'已确认', PENDING:'待确认', CANCELLED:'已取消', COMPLETED:'已完成', NO_SHOW:'未到场'
}

export default function DashboardPage() {
  const router = useRouter()
  const [appts, setAppts]       = useState<Appointment[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<Appointment | null>(null)
  const [updating, setUpdating] = useState(false)
  const [lang, setLang]         = useState<'zh'|'en'>('zh')
  const [toast, setToast]       = useState('')
  const [isMobile, setIsMobile] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    fetch(`/api/appointments?date=${today}`)
      .then(r => r.json())
      .then(data => { setAppts(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function updateStatus(id: string, status: string) {
    setUpdating(true)
    const res = await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setUpdating(false)
    if (res.ok) {
      setAppts(prev => prev.map(a => a.id === id ? { ...a, status } : a))
      setModal(m => m?.id === id ? { ...m, status } : m)
      showToast(lang==='zh' ? `状态已更新为 ${STATUS_ZH[status]}` : `Status updated to ${status}`)
    }
  }

  const confirmed = appts.filter(a => a.status === 'CONFIRMED').length
  const pending   = appts.filter(a => a.status === 'PENDING').length
  const completed = appts.filter(a => a.status === 'COMPLETED').length
  const revenue   = appts.filter(a => ['CONFIRMED','COMPLETED'].includes(a.status))
                         .reduce((sum, a) => sum + Number(a.service.price), 0)

  const fmt      = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone:'America/New_York', hour:'numeric', minute:'2-digit', hour12:true })
  const fmtFull  = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone:'America/New_York', month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', hour12:true })
  const fmtPhone = (p: string)   => p.replace(/(\+\d)(\d+)(\d{4})$/, '$1****$3')

  const T = {
    title:    lang==='zh' ? '今日概览' : "Today's Overview",
    date:     new Date().toLocaleDateString(lang==='zh'?'zh-CN':'en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }),
    newAppt:  lang==='zh' ? '＋ 录入预约' : '＋ New Booking',
    labels:   lang==='zh'
      ? ['今日预约','已确认','待确认','今日营收']
      : ["Today's Appts",'Confirmed','Pending',"Today's Revenue"],
    tHeaders: lang==='zh'
      ? ['时间','客户','项目','技师','状态','来源','']
      : ['Time','Customer','Service','Therapist','Status','Source',''],
    empty:    lang==='zh' ? '今日暂无预约' : 'No appointments today',
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:600 }}>{T.title}</h1>
          <div style={{ fontSize:'0.82rem', color:'#7a8ba8', marginTop:'0.2rem' }}>{T.date}</div>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          <div style={{ display:'flex', gap:'0.3rem' }}>
            {(['zh','en'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{ padding:'0.2rem 0.5rem', borderRadius:10, border:`1px solid ${lang===l?'#e8b86d':'#2a3045'}`, background:lang===l?'#e8b86d':'transparent', color:lang===l?'#0f1117':'#7a8ba8', fontSize:'0.6rem', fontFamily:'monospace', cursor:'pointer' }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button onClick={() => router.push('/admin/appointments/new')}
            style={{ padding:'0.5rem 1rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
            {T.newAppt}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'0.75rem', marginBottom:'1.5rem' }}>
        {[
          { label:T.labels[0], value:appts.length, color:'#e8b86d',  sub:`${completed} ${lang==='zh'?'已完成':'completed'}` },
          { label:T.labels[1], value:confirmed,    color:'#6dbf8e',  sub:`${pending} ${lang==='zh'?'待处理':'pending'}` },
          { label:T.labels[2], value:pending,       color:'#f87171',  sub: pending>0?(lang==='zh'?'需要确认':'needs action'):(lang==='zh'?'全部已处理':'all handled') },
          { label:T.labels[3], value:`$${revenue}`, color:'#60a5fa',  sub:lang==='zh'?'按项目价格':'by service price' },
        ].map(s => (
          <div key={s.label} style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, padding:'1rem 1.1rem', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${s.color},${s.color}88)` }}/>
            <div style={{ fontFamily:'monospace', fontSize:'0.62rem', color:'#7a8ba8', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'0.5rem' }}>{s.label}</div>
            <div style={{ fontSize:'1.7rem', fontWeight:600, lineHeight:1, marginBottom:'0.25rem' }}>{s.value}</div>
            <div style={{ fontSize:'0.7rem', color:'#6dbf8e' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Appointments list */}
      <div style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, overflow:'hidden' }}>
        <div style={{ padding:'0.9rem 1rem', borderBottom:'1px solid #2a3045', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:'0.85rem', fontWeight:500 }}>{lang==='zh'?'今日预约':'Today\'s Appointments'}</span>
          <span style={{ fontFamily:'monospace', fontSize:'0.7rem', color:'#7a8ba8' }}>{appts.length} {lang==='zh'?'条':'total'}</span>
        </div>

        {loading ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'#7a8ba8', fontSize:'0.85rem' }}>
            {lang==='zh'?'加载中…':'Loading…'}
          </div>
        ) : appts.length === 0 ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'#7a8ba8', fontSize:'0.85rem' }}>{T.empty}</div>
        ) : isMobile ? (
          /* ── Mobile card list ── */
          <div style={{ display:'flex', flexDirection:'column' }}>
            {appts.map((a, i) => {
              const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.PENDING
              return (
                <div key={a.id}
                  style={{ padding:'0.9rem 1rem', borderBottom: i < appts.length-1 ? '1px solid rgba(42,48,69,0.5)' : 'none', display:'flex', gap:'0.75rem', alignItems:'flex-start' }}
                  onClick={() => setModal(a)}>
                  {/* Time column */}
                  <div style={{ flexShrink:0, textAlign:'center', minWidth:52 }}>
                    <div style={{ fontFamily:'monospace', fontSize:'0.78rem', fontWeight:600, color:'#e8b86d', lineHeight:1.3 }}>{fmt(a.appointmentAt)}</div>
                    <div style={{ fontFamily:'monospace', fontSize:'0.62rem', color:'#7a8ba8' }}>{a.service.durationMin}m</div>
                  </div>
                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'0.87rem', fontWeight:500, marginBottom:'0.2rem' }}>{a.customerName}</div>
                    <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginBottom:'0.3rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {a.service.name} · {a.therapist.name}
                    </div>
                    <div style={{ display:'flex', gap:'0.4rem', alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', padding:'0.12rem 0.5rem', borderRadius:20, background:st.bg, color:st.color, fontFamily:'monospace', fontSize:'0.6rem', fontWeight:500 }}>
                        <span style={{ width:4, height:4, borderRadius:'50%', background:st.dot }}/>
                        {lang==='zh' ? (STATUS_ZH[a.status]??a.status) : a.status}
                      </span>
                      <span style={{ fontFamily:'monospace', fontSize:'0.65rem', color:'#e8b86d' }}>${Number(a.service.price).toFixed(0)}</span>
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
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #2a3045', background:'#161b27' }}>
                  {T.tHeaders.map(h => (
                    <th key={h} style={{ padding:'0.7rem 1rem', textAlign:'left', fontFamily:'monospace', fontSize:'0.62rem', letterSpacing:'0.1em', textTransform:'uppercase', color:'#7a8ba8', fontWeight:400, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appts.map(a => {
                  const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.PENDING
                  return (
                    <tr key={a.id} style={{ borderBottom:'1px solid rgba(42,48,69,0.5)', cursor:'pointer', transition:'background 0.1s' }}
                      onMouseEnter={e=>(e.currentTarget.style.background='rgba(42,48,69,0.3)')}
                      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <td style={{ padding:'0.8rem 1rem', fontFamily:'monospace', fontSize:'0.8rem', whiteSpace:'nowrap' }}>{fmt(a.appointmentAt)}</td>
                      <td style={{ padding:'0.8rem 1rem', fontSize:'0.85rem' }}>{a.customerName}</td>
                      <td style={{ padding:'0.8rem 1rem', fontSize:'0.82rem', color:'#94a3b8', whiteSpace:'nowrap' }}>{a.service.name}</td>
                      <td style={{ padding:'0.8rem 1rem', fontSize:'0.82rem', whiteSpace:'nowrap' }}>{a.therapist.name}</td>
                      <td style={{ padding:'0.8rem 1rem' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:'0.35rem', padding:'0.18rem 0.6rem', borderRadius:20, background:st.bg, color:st.color, fontFamily:'monospace', fontSize:'0.62rem', letterSpacing:'0.05em', fontWeight:500, whiteSpace:'nowrap' }}>
                          <span style={{ width:5, height:5, borderRadius:'50%', background:st.dot, flexShrink:0 }}/>
                          {lang==='zh' ? (STATUS_ZH[a.status]??a.status) : a.status}
                        </span>
                      </td>
                      <td style={{ padding:'0.8rem 1rem' }}>
                        <span style={{ padding:'0.12rem 0.5rem', borderRadius:4, fontFamily:'monospace', fontSize:'0.62rem', background:a.source==='ONLINE'?'rgba(167,139,250,0.15)':'rgba(96,165,250,0.15)', color:a.source==='ONLINE'?'#a78bfa':'#60a5fa', whiteSpace:'nowrap' }}>
                          {a.source==='ONLINE'?(lang==='zh'?'在线':'Online'):(lang==='zh'?'电话':'Manual')}
                        </span>
                      </td>
                      <td style={{ padding:'0.8rem 1rem' }}>
                        <button onClick={() => setModal(a)} style={{ padding:'0.25rem 0.7rem', borderRadius:5, background:'transparent', border:'1px solid #2a3045', color:'#7a8ba8', fontSize:'0.75rem', cursor:'pointer', whiteSpace:'nowrap' }}>
                          {lang==='zh'?'详情':'View'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#161b27', border:'1px solid #2a3045', borderRadius: isMobile ? '12px 12px 0 0' : 12, width: isMobile ? '100%' : 'min(500px,94vw)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)', maxHeight:'90vh', overflow:'auto' }}>
            <div style={{ padding:'1.2rem 1.4rem', borderBottom:'1px solid #2a3045', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#161b27' }}>
              <span style={{ fontWeight:600 }}>{lang==='zh'?'预约详情':'Appointment Details'}</span>
              <button onClick={() => setModal(null)} style={{ width:28, height:28, borderRadius:'50%', background:'#1c2333', border:'1px solid #2a3045', color:'#7a8ba8', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:'1.4rem' }}>
              {/* Customer header */}
              <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.2rem', paddingBottom:'1.2rem', borderBottom:'1px solid #2a3045' }}>
                <div style={{ width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg,#e8b86d,#a78bfa)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', flexShrink:0 }}>👤</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500, fontSize:'1rem' }}>{modal.customerName}</div>
                  <div style={{ fontFamily:'monospace', fontSize:'0.72rem', color:'#7a8ba8' }}>{fmtPhone(modal.customerPhone)}</div>
                </div>
                <div style={{ display:'inline-flex', alignItems:'center', gap:'0.35rem', padding:'0.18rem 0.6rem', borderRadius:20, background:STATUS_STYLE[modal.status]?.bg, color:STATUS_STYLE[modal.status]?.color, fontFamily:'monospace', fontSize:'0.65rem', fontWeight:500, flexShrink:0 }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', background:STATUS_STYLE[modal.status]?.dot, flexShrink:0 }}/>
                  {lang==='zh' ? (STATUS_ZH[modal.status]??modal.status) : modal.status}
                </div>
              </div>

              {[
                [lang==='zh'?'项目':'Service',     modal.service.name],
                [lang==='zh'?'时长':'Duration',    `${modal.service.durationMin} min`],
                [lang==='zh'?'价格':'Price',        `$${Number(modal.service.price).toFixed(0)}`],
                [lang==='zh'?'技师':'Therapist',   modal.therapist.name],
                [lang==='zh'?'时间':'Time',         fmtFull(modal.appointmentAt)],
                [lang==='zh'?'来源':'Source',       modal.source==='ONLINE'?(lang==='zh'?'在线预约':'Online'):(lang==='zh'?'电话录入':'Manual Entry')],
              ].map(([k,v]) => (
                <div key={k as string} style={{ display:'flex', justifyContent:'space-between', padding:'0.5rem 0', borderBottom:'1px solid rgba(42,48,69,0.5)', fontSize:'0.85rem' }}>
                  <span style={{ color:'#7a8ba8' }}>{k}</span>
                  <span style={{ textAlign:'right', maxWidth:'60%' }}>{v}</span>
                </div>
              ))}
              {modal.notes && (
                <div style={{ padding:'0.75rem', marginTop:'0.5rem', background:'rgba(42,48,69,0.3)', borderRadius:6, fontSize:'0.82rem', color:'#94a3b8', lineHeight:1.6 }}>
                  📝 {modal.notes}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display:'flex', gap:'0.6rem', marginTop:'1.2rem', flexWrap:'wrap' }}>
                {modal.status === 'PENDING' && (
                  <button onClick={()=>updateStatus(modal.id,'CONFIRMED')} disabled={updating}
                    style={{ flex:1, padding:'0.65rem', background:'rgba(109,191,142,0.15)', border:'1px solid rgba(109,191,142,0.3)', borderRadius:6, color:'#6dbf8e', fontSize:'0.82rem', cursor:'pointer', minWidth:80 }}>
                    ✓ {lang==='zh'?'确认':'Confirm'}
                  </button>
                )}
                {['PENDING','CONFIRMED'].includes(modal.status) && (
                  <button onClick={()=>updateStatus(modal.id,'COMPLETED')} disabled={updating}
                    style={{ flex:1, padding:'0.65rem', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.25)', borderRadius:6, color:'#60a5fa', fontSize:'0.82rem', cursor:'pointer', minWidth:80 }}>
                    {lang==='zh'?'完成':'Complete'}
                  </button>
                )}
                {['PENDING','CONFIRMED'].includes(modal.status) && (
                  <button onClick={()=>updateStatus(modal.id,'NO_SHOW')} disabled={updating}
                    style={{ flex:1, padding:'0.65rem', background:'rgba(148,163,184,0.1)', border:'1px solid rgba(148,163,184,0.25)', borderRadius:6, color:'#94a3b8', fontSize:'0.82rem', cursor:'pointer', minWidth:80 }}>
                    {lang==='zh'?'未到场':'No Show'}
                  </button>
                )}
                {!['CANCELLED','COMPLETED'].includes(modal.status) && (
                  <button onClick={()=>updateStatus(modal.id,'CANCELLED')} disabled={updating}
                    style={{ flex:1, padding:'0.65rem', background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:6, color:'#f87171', fontSize:'0.82rem', cursor:'pointer', minWidth:80 }}>
                    {lang==='zh'?'取消':'Cancel'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div style={{ position:'fixed', bottom:'1.5rem', right:'1.5rem', background:'#1c2333', border:'1px solid #2a3045', borderLeft:'3px solid #6dbf8e', borderRadius:6, padding:'0.75rem 1.2rem', fontSize:'0.82rem', transition:'all 0.3s', opacity:toast?1:0, transform:toast?'translateY(0)':'translateY(60px)', pointerEvents:'none', zIndex:600 }}>
        {toast}
      </div>
    </div>
  )
}
