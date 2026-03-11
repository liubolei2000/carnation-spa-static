'use client'
// src/app/admin/appointments/new/page.tsx — 手动录入预约
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Service   { id:string; name:string; durationMin:number; price:string }
interface AvailSlot { time:string; available:boolean }
interface AvailResult { therapistId:string; therapistName:string; slots:AvailSlot[] }

function getNext30Days() {
  return Array.from({length:30}, (_,i) => { const d=new Date(); d.setDate(d.getDate()+i); return d })
}

export default function NewAppointmentPage() {
  const router = useRouter()
  const [services,   setServices]   = useState<Service[]>([])
  const [selService,   setSelService]   = useState('')
  const [selDate,      setSelDate]      = useState('')
  const [selTherapist, setSelTherapist] = useState('')
  const [selTime,      setSelTime]      = useState('')
  const [avail,        setAvail]        = useState<AvailResult[]>([])
  const [loadingAvail, setLoadingAvail] = useState(false)
  const [name,  setName]  = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]   = useState('')
  const [toast, setToast]   = useState('')
  const [lang, setLang]     = useState<'zh'|'en'>('zh')

  const days = getNext30Days()

  useEffect(() => {
    fetch('/api/services').then(r=>r.json()).then(d => setServices(Array.isArray(d)?d:[])).catch(()=>{})
  }, [])

  useEffect(() => {
    if (!selDate || !selService) return
    setLoadingAvail(true); setAvail([]); setSelTherapist(''); setSelTime('')
    fetch(`/api/availability?date=${selDate}&serviceId=${selService}`)
      .then(r=>r.json()).then(d=>{ setAvail(Array.isArray(d)?d:[]); setLoadingAvail(false) })
      .catch(()=>setLoadingAvail(false))
  }, [selDate, selService])

  async function submit() {
    if (!selService||!selDate||!selTherapist||!selTime||!name||!phone) {
      setError(lang==='zh'?'请填写所有必填项':'Fill in all required fields'); return
    }
    setSubmitting(true); setError('')
    const res = await fetch('/api/appointments', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ serviceId:selService, therapistId:selTherapist, customerName:name, customerPhone:phone, date:selDate, time:selTime, notes, source:'MANUAL' })
    })
    setSubmitting(false)
    if (res.ok) {
      setToast(lang==='zh'?'预约已录入 ✓':'Booking created ✓')
      setTimeout(() => router.push('/admin/dashboard'), 1200)
    } else {
      const d = await res.json()
      if (d.error==='TIME_SLOT_TAKEN')  setError(lang==='zh'?'该时间段已被预约，请重新选择':'This time slot is taken')
      else if (d.error==='INVALID_PHONE') setError(lang==='zh'?'手机号格式错误':'Invalid phone format')
      else if (d.error==='FORBIDDEN')   setError(lang==='zh'?'权限不足':'Permission denied')
      else setError(lang==='zh'?'录入失败，请重试':'Failed, please try again')
    }
  }

  const inp: React.CSSProperties = { width:'100%', padding:'0.75rem 1rem', background:'#1c2333', border:'1px solid #2a3045', borderRadius:6, color:'#e2e8f0', fontSize:'0.88rem', outline:'none', boxSizing:'border-box' }
  const lbl: React.CSSProperties = { display:'block', fontSize:'0.72rem', fontWeight:500, color:'#7a8ba8', marginBottom:'0.5rem', letterSpacing:'0.05em', textTransform:'uppercase' }
  const selSvc = services.find(s => s.id === selService)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
        <button onClick={()=>router.back()} style={{ padding:'0.3rem 0.7rem', background:'transparent', border:'1px solid #2a3045', borderRadius:5, color:'#7a8ba8', fontSize:'0.78rem', cursor:'pointer' }}>← {lang==='zh'?'返回':'Back'}</button>
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:'1.3rem', fontWeight:600 }}>{lang==='zh'?'手动录入预约':'New Manual Booking'}</h1>
          <div style={{ fontSize:'0.82rem', color:'#7a8ba8', marginTop:'0.2rem' }}>{lang==='zh'?'电话/前台录入，无需短信验证':'Phone or walk-in booking — no SMS code required'}</div>
        </div>
        <div style={{ display:'flex', gap:'0.3rem' }}>
          {(['zh','en'] as const).map(l => (
            <button key={l} onClick={()=>setLang(l)} style={{ padding:'0.2rem 0.5rem', borderRadius:10, border:`1px solid ${lang===l?'#e8b86d':'#2a3045'}`, background:lang===l?'#e8b86d':'transparent', color:lang===l?'#0f1117':'#7a8ba8', fontSize:'0.6rem', fontFamily:'monospace', cursor:'pointer' }}>{l.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', maxWidth:960 }}>
        {/* Left: service + date + time */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1.2rem' }}>
          {/* Service picker */}
          <div style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, padding:'1.4rem' }}>
            <div style={{ fontSize:'0.8rem', fontWeight:600, color:'#e8b86d', marginBottom:'1rem' }}>
              📋 {lang==='zh'?'选择项目':'Select Service'}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {services.map(s => (
                <div key={s.id} onClick={() => setSelService(s.id)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.65rem 0.8rem', borderRadius:6, border:`1px solid ${selService===s.id?'#e8b86d':'#2a3045'}`, background:selService===s.id?'rgba(232,184,109,0.08)':'transparent', cursor:'pointer', transition:'all 0.15s' }}>
                  <span style={{ fontSize:'0.85rem', fontWeight:selService===s.id?500:400 }}>{s.name}</span>
                  <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                    <span style={{ fontFamily:'monospace', fontSize:'0.62rem', color:'#7a8ba8' }}>{s.durationMin}min</span>
                    <span style={{ fontFamily:'monospace', fontSize:'0.72rem', color:'#e8b86d', fontWeight:600 }}>${Number(s.price).toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Date picker */}
          <div style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, padding:'1.4rem' }}>
            <div style={{ fontSize:'0.8rem', fontWeight:600, color:'#e8b86d', marginBottom:'1rem' }}>
              📅 {lang==='zh'?'选择日期':'Select Date'}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem' }}>
              {days.slice(0,14).map((d,i) => {
                const iso = d.toISOString().split('T')[0]
                const dow = i===0?(lang==='zh'?'今天':'Today'):['日','一','二','三','四','五','六'][d.getDay()]
                return (
                  <div key={iso} onClick={()=>setSelDate(iso)}
                    style={{ padding:'0.4rem 0.6rem', border:`1px solid ${selDate===iso?'#e8b86d':'#2a3045'}`, fontFamily:'monospace', fontSize:'0.65rem', color:selDate===iso?'#0f1117':'#7a8ba8', cursor:'pointer', background:selDate===iso?'#e8b86d':'transparent', borderRadius:4, textAlign:'center', minWidth:46, transition:'all 0.15s' }}>
                    <div>{dow}</div><div>{d.getDate()}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Time slots */}
          {selDate && selService && (
            <div style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, padding:'1.4rem' }}>
              <div style={{ fontSize:'0.8rem', fontWeight:600, color:'#e8b86d', marginBottom:'1rem' }}>
                🕐 {lang==='zh'?'可用时段':'Available Times'}
                {loadingAvail && <span style={{ fontSize:'0.7rem', color:'#7a8ba8', fontWeight:400, marginLeft:'0.5rem' }}>{lang==='zh'?'加载中…':'loading…'}</span>}
              </div>
              {!loadingAvail && avail.length === 0 && (
                <div style={{ color:'#7a8ba8', fontSize:'0.82rem' }}>{lang==='zh'?'该日期暂无可用时段':'No availability for this date'}</div>
              )}
              {avail.map(t => (
                <div key={t.therapistId} style={{ marginBottom:'1.2rem' }}>
                  <div style={{ fontSize:'0.8rem', fontWeight:500, marginBottom:'0.5rem', color: selTherapist===t.therapistId?'#e8b86d':'#94a3b8' }}>
                    🧘 {t.therapistName}
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem' }}>
                    {t.slots.filter(s=>s.available).map(slot => {
                      const isSel = selTherapist===t.therapistId && selTime===slot.time
                      return (
                        <div key={slot.time} onClick={()=>{ setSelTherapist(t.therapistId); setSelTime(slot.time) }}
                          style={{ padding:'0.3rem 0.7rem', border:`1px solid ${isSel?'#e8b86d':'#2a3045'}`, fontFamily:'monospace', fontSize:'0.75rem', color:isSel?'#0f1117':'#7a8ba8', cursor:'pointer', background:isSel?'#e8b86d':'transparent', borderRadius:4, transition:'all 0.15s' }}>
                          {slot.time}
                        </div>
                      )
                    })}
                    {t.slots.every(s=>!s.available) && (
                      <span style={{ fontSize:'0.75rem', color:'#7a8ba8' }}>{lang==='zh'?'当日已满':'Fully booked'}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: customer info + confirm */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1.2rem' }}>
          <div style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, padding:'1.4rem' }}>
            <div style={{ fontSize:'0.8rem', fontWeight:600, color:'#e8b86d', marginBottom:'1rem' }}>
              👤 {lang==='zh'?'客户信息':'Customer Info'}
            </div>
            <div style={{ marginBottom:'1rem' }}>
              <label style={lbl}>{lang==='zh'?'客户姓名':'Full Name'} *</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="John Smith" style={inp} />
            </div>
            <div style={{ marginBottom:'1rem' }}>
              <label style={lbl}>{lang==='zh'?'手机号码':'Phone Number'} *</label>
              <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 (xxx) xxx-xxxx" type="tel" style={inp} />
            </div>
            <div>
              <label style={lbl}>{lang==='zh'?'备注（可选）':'Notes (optional)'}</label>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
                placeholder={lang==='zh'?'过敏史、特殊要求等…':'Allergies, special requests…'}
                style={{...inp, resize:'vertical'}} />
            </div>
          </div>

          {/* Summary */}
          {selService && selDate && selTherapist && selTime && (
            <div style={{ background:'rgba(232,184,109,0.06)', border:'1px solid rgba(232,184,109,0.2)', borderRadius:8, padding:'1.2rem' }}>
              <div style={{ fontSize:'0.75rem', fontWeight:600, color:'#e8b86d', marginBottom:'0.8rem', fontFamily:'monospace', letterSpacing:'0.08em', textTransform:'uppercase' }}>
                {lang==='zh'?'确认信息':'Booking Summary'}
              </div>
              {[
                [lang==='zh'?'项目':'Service', selSvc?.name ?? ''],
                [lang==='zh'?'时长':'Duration', `${selSvc?.durationMin} min`],
                [lang==='zh'?'价格':'Price',    `$${Number(selSvc?.price??0).toFixed(0)}`],
                [lang==='zh'?'日期':'Date',     selDate],
                [lang==='zh'?'时间':'Time',     selTime],
              ].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'0.3rem 0', fontSize:'0.82rem' }}>
                  <span style={{ color:'#7a8ba8' }}>{k}</span>
                  <span style={{ fontWeight:500 }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ padding:'0.75rem 1rem', background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:6, fontSize:'0.82rem', color:'#f87171', fontFamily:'monospace' }}>
              {error}
            </div>
          )}

          <button onClick={submit}
            disabled={submitting||!selService||!selDate||!selTherapist||!selTime||!name||!phone}
            style={{ padding:'0.9rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.88rem', fontWeight:600, cursor:'pointer', opacity:(submitting||!selService||!selDate||!selTherapist||!selTime||!name||!phone)?0.4:1, transition:'opacity 0.2s' }}>
            {submitting ? (lang==='zh'?'录入中…':'Creating…') : `✓ ${lang==='zh'?'确认录入预约':'Confirm Booking'}`}
          </button>
        </div>
      </div>

      <div style={{ position:'fixed', bottom:'1.5rem', right:'1.5rem', background:'#1c2333', border:'1px solid #2a3045', borderLeft:'3px solid #6dbf8e', borderRadius:6, padding:'0.75rem 1.2rem', fontSize:'0.82rem', transition:'all 0.3s', opacity:toast?1:0, transform:toast?'translateY(0)':'translateY(60px)', pointerEvents:'none', zIndex:600 }}>
        {toast}
      </div>
    </div>
  )
}
