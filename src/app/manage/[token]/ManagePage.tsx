'use client'
// src/app/manage/[token]/ManagePage.tsx
// 顾客自助管理预约：查看、改期、取消
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL ?? ''

interface Appt {
  id: string; customerName: string; customerPhone: string
  appointmentAt: string; endsAt: string; status: string; notes: string | null
  service:   { id: string; name: string; durationMin: number; price: string }
  therapist: { name: string; title: string | null }
}
interface AvailSlot { time: string; available: boolean }
interface AvailResult { therapistId: string; therapistName: string; slots: AvailSlot[] }

const EMOJIS = ['🌿','💆','🕯️','🪨','💎','🌸','🧘','✨']

function getNext14Days() {
  return Array.from({length:14}, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d
  })
}

export default function ManagePage() {
  const { token } = useParams<{ token: string }>()
  const [appt, setAppt]   = useState<Appt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView]   = useState<'detail' | 'reschedule' | 'cancelled' | 'done'>('detail')

  // reschedule state
  const [selDate,      setSelDate]      = useState('')
  const [selTherapist, setSelTherapist] = useState('')
  const [selTime,      setSelTime]      = useState('')
  const [avail,        setAvail]        = useState<AvailResult[]>([])
  const [loadingAvail, setLoadingAvail] = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [actionError,  setActionError]  = useState('')

  const days = getNext14Days()

  useEffect(() => {
    fetch(`${API}/api/appointments/token/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setAppt(d); setLoading(false) })
      .catch(e => { setError(e === 404 ? 'Booking not found or link expired.' : 'Failed to load booking.'); setLoading(false) })
  }, [token])

  useEffect(() => {
    if (!selDate || !appt) return
    setLoadingAvail(true); setAvail([]); setSelTherapist(''); setSelTime('')
    fetch(`${API}/api/availability?date=${selDate}&serviceId=${appt.service.id}`)
      .then(r => r.json())
      .then(d => { setAvail(Array.isArray(d) ? d : []); setLoadingAvail(false) })
      .catch(() => setLoadingAvail(false))
  }, [selDate])

  async function cancel() {
    if (!confirm('Are you sure you want to cancel this appointment?')) return
    setSubmitting(true)
    const res = await fetch(`${API}/api/appointments/token/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    setSubmitting(false)
    if (res.ok) { setView('cancelled') }
    else setActionError('Failed to cancel. Please call us at (978) 330-0895.')
  }

  async function reschedule() {
    if (!selDate || !selTherapist || !selTime) { setActionError('Please select a date and time.'); return }
    setSubmitting(true); setActionError('')
    const res = await fetch(`${API}/api/appointments/token/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reschedule', date: selDate, time: selTime, therapistId: selTherapist }),
    })
    setSubmitting(false)
    if (res.ok) {
      const updated = await res.json()
      setAppt(updated); setView('done')
    } else {
      const d = await res.json()
      setActionError(d.error === 'TIME_SLOT_TAKEN' ? 'That time is no longer available. Please choose another.' : 'Reschedule failed. Please call us at (978) 330-0895.')
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York', weekday:'long', month:'long', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', hour12:true
  })
  const fmtShort = (iso: string) => new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true
  })

  const TAVATAR = ['🧘‍♀️','🌸','💫','🌿','✨','💆']

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#F3F0EE',
    fontFamily: "'Jost', sans-serif",
    fontWeight: 300,
  }

  const css = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#F3F0EE;font-family:'Jost',sans-serif;font-weight:300;color:#1A1218}`

  if (loading) return (
    <>
      <style dangerouslySetInnerHTML={{__html:css}}/>
      <div style={{...pageStyle, display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{ textAlign:'center', color:'#B09098' }}>
          <div style={{ fontSize:'2rem', marginBottom:'1rem' }}>🌸</div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.8rem', letterSpacing:'0.1em' }}>Loading your booking…</div>
        </div>
      </div>
    </>
  )

  if (error) return (
    <>
      <style dangerouslySetInnerHTML={{__html:css}}/>
      <div style={{...pageStyle, display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{ textAlign:'center', maxWidth:360, padding:'2rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>🔍</div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.8rem', fontWeight:300, color:'#1A1218', marginBottom:'1rem' }}>Booking Not Found</h2>
          <p style={{ color:'#B09098', lineHeight:1.8, marginBottom:'2rem' }}>{error}</p>
          <a href="/" style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.8rem', letterSpacing:'0.15em', textTransform:'uppercase', color:'#1A1218', textDecoration:'none', borderBottom:'1px solid #DDB8C4', paddingBottom:2 }}>
            Back to Homepage
          </a>
        </div>
      </div>
    </>
  )

  const isCancellable = appt && !['CANCELLED','COMPLETED','NO_SHOW'].includes(appt.status)

  return (
    <>
      <style dangerouslySetInnerHTML={{__html:css}}/>
      {/* Nav */}
      <nav style={{ background:'rgba(243,240,238,0.95)', backdropFilter:'blur(12px)', borderBottom:'1px solid #EDD8DF', padding:'1rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <a href="/" style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.4rem', fontWeight:400, letterSpacing:'0.2em', color:'#1A1218', textDecoration:'none' }}>Carnation</a>
        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', letterSpacing:'0.15em', textTransform:'uppercase', color:'#B09098' }}>Manage Booking</span>
      </nav>

      <div style={{ maxWidth:560, margin:'0 auto', padding:'3rem 1.5rem' }}>

        {/* ── DETAIL VIEW ── */}
        {view === 'detail' && appt && (
          <>
            <div style={{ textAlign:'center', marginBottom:'2.5rem' }}>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', letterSpacing:'0.35em', textTransform:'uppercase', color:'#B09098', marginBottom:'0.8rem' }}>your appointment</div>
              <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'2.5rem', fontWeight:300, color:'#1A1218', lineHeight:1.1 }}>Hello, {appt.customerName.split(' ')[0]}</h1>
            </div>

            {/* Status badge */}
            {appt.status === 'CANCELLED' && (
              <div style={{ background:'rgba(184,92,56,0.08)', border:'1px solid rgba(184,92,56,0.2)', borderRadius:8, padding:'0.9rem 1.2rem', marginBottom:'1.5rem', textAlign:'center', fontFamily:"'DM Mono',monospace", fontSize:'0.8rem', color:'#b85c38' }}>
                This appointment has been cancelled
              </div>
            )}
            {appt.status === 'CONFIRMED' && (
              <div style={{ background:'rgba(125,140,114,0.1)', border:'1px solid rgba(125,140,114,0.25)', borderRadius:8, padding:'0.9rem 1.2rem', marginBottom:'1.5rem', textAlign:'center', fontFamily:"'DM Mono',monospace", fontSize:'0.8rem', color:'#7d8c72' }}>
                ✓ Confirmed — we'll see you soon!
              </div>
            )}

            {/* Booking card */}
            <div style={{ background:'white', border:'1.5px solid #EDD8DF', borderRadius:8, overflow:'hidden', marginBottom:'1.5rem' }}>
              <div style={{ background:'linear-gradient(135deg,#FFF8FA,#EDD8DF)', padding:'1.5rem 1.8rem', borderBottom:'1px solid #EDD8DF' }}>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.5rem', fontWeight:400, color:'#1A1218', marginBottom:'0.3rem' }}>{appt.service.name}</div>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', color:'#B09098', letterSpacing:'0.1em', textTransform:'uppercase' }}>{appt.service.durationMin} min · ${Number(appt.service.price).toFixed(0)}</div>
              </div>
              <div style={{ padding:'1.5rem 1.8rem' }}>
                {[
                  ['📅 Date & Time', fmt(appt.appointmentAt)],
                  ['🧘 Therapist', `${appt.therapist.name}${appt.therapist.title ? ' · ' + appt.therapist.title : ''}`],
                  ['📍 Location', '120 Cambridge St, Suite 8\nBurlington, MA 01803'],
                ].map(([k,v]) => (
                  <div key={k as string} style={{ display:'flex', gap:'1rem', padding:'0.75rem 0', borderBottom:'1px solid #F5F0F2' }}>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', color:'#B09098', textTransform:'uppercase', letterSpacing:'0.08em', minWidth:100 }}>{k}</span>
                    <span style={{ fontSize:'0.9rem', color:'#1A1218', lineHeight:1.6, whiteSpace:'pre-line' }}>{v}</span>
                  </div>
                ))}
                {appt.notes && (
                  <div style={{ display:'flex', gap:'1rem', padding:'0.75rem 0' }}>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', color:'#B09098', textTransform:'uppercase', letterSpacing:'0.08em', minWidth:100 }}>📝 Notes</span>
                    <span style={{ fontSize:'0.9rem', color:'#8A4858', lineHeight:1.6 }}>{appt.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {isCancellable && (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                <button onClick={() => setView('reschedule')}
                  style={{ width:'100%', padding:'1rem', background:'#D4899A', color:'white', border:'none', borderRadius:6, fontFamily:"'DM Mono',monospace", fontSize:'0.82rem', letterSpacing:'0.15em', textTransform:'uppercase', cursor:'pointer' }}>
                  Reschedule Appointment
                </button>
                <button onClick={cancel} disabled={submitting}
                  style={{ width:'100%', padding:'0.85rem', background:'transparent', color:'#b85c38', border:'1.5px solid rgba(184,92,56,0.25)', borderRadius:6, fontFamily:"'DM Mono',monospace", fontSize:'0.78rem', letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer' }}>
                  {submitting ? 'Cancelling…' : 'Cancel Appointment'}
                </button>
              </div>
            )}

            {actionError && (
              <div style={{ marginTop:'1rem', padding:'0.75rem 1rem', background:'rgba(184,92,56,0.08)', border:'1px solid rgba(184,92,56,0.2)', borderRadius:6, fontSize:'0.85rem', color:'#b85c38', fontFamily:"'DM Mono',monospace" }}>
                {actionError}
              </div>
            )}

            <div style={{ marginTop:'2rem', textAlign:'center' }}>
              <a href="tel:9783300895" style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', letterSpacing:'0.15em', textTransform:'uppercase', color:'#a8927a', textDecoration:'none' }}>
                Need help? Call (978) 330-0895
              </a>
            </div>
          </>
        )}

        {/* ── RESCHEDULE VIEW ── */}
        {view === 'reschedule' && appt && (
          <>
            <div style={{ marginBottom:'2rem' }}>
              <button onClick={() => setView('detail')} style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', letterSpacing:'0.1em', color:'#a8927a', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'1.5rem' }}>
                ← Back
              </button>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', letterSpacing:'0.35em', textTransform:'uppercase', color:'#B09098', marginBottom:'0.5rem' }}>reschedule</div>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'2rem', fontWeight:300, color:'#1A1218' }}>Choose a new time</h2>
            </div>

            <div style={{ background:'#F5F0F2', border:'1px solid #EDD8DF', borderRadius:6, padding:'0.9rem 1.2rem', marginBottom:'1.5rem', fontSize:'0.85rem', color:'#8A4858' }}>
              Current: {fmtShort(appt.appointmentAt)} with {appt.therapist.name}
            </div>

            {/* Date selection */}
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', letterSpacing:'0.15em', textTransform:'uppercase', color:'#B09098', marginBottom:'0.8rem' }}>Select a date</div>
            <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'2rem' }}>
              {days.map((d,i) => {
                const iso = d.toISOString().split('T')[0]
                const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]
                return (
                  <div key={iso} onClick={() => setSelDate(iso)}
                    style={{ padding:'0.5rem 0.8rem', border:`1.5px solid ${selDate===iso?'#1A1218':'#EDD8DF'}`, fontFamily:"'DM Mono',monospace", fontSize:'0.7rem', color:selDate===iso?'white':'#8A4858', cursor:'pointer', background:selDate===iso?'#1A1218':'white', borderRadius:1, textAlign:'center', minWidth:52, transition:'all 0.2s' }}>
                    <div>{dow}</div><div>{d.getDate()}</div>
                  </div>
                )
              })}
            </div>

            {/* Time slots */}
            {selDate && (
              <>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', letterSpacing:'0.15em', textTransform:'uppercase', color:'#B09098', marginBottom:'0.8rem' }}>
                  Available times {loadingAvail && '— loading…'}
                </div>
                {!loadingAvail && avail.length === 0 && (
                  <div style={{ color:'#B09098', fontSize:'0.9rem', padding:'1rem 0' }}>No availability for this date.</div>
                )}
                {avail.map((t,ti) => (
                  <div key={t.therapistId} style={{ marginBottom:'1.5rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.8rem', marginBottom:'0.6rem' }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#DDB8C4,#8A4858)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem' }}>
                        {TAVATAR[ti%TAVATAR.length]}
                      </div>
                      <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.05rem', color:'#1A1218' }}>{t.therapistName}</span>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem' }}>
                      {t.slots.map(slot => {
                        const sel = selTherapist===t.therapistId && selTime===slot.time
                        return (
                          <div key={slot.time} onClick={() => { if (!slot.available) return; setSelTherapist(t.therapistId); setSelTime(slot.time) }}
                            style={{ padding:'0.48rem 0.9rem', border:`1.5px solid ${sel?'#1A1218':'#EDD8DF'}`, fontFamily:"'DM Mono',monospace", fontSize:'0.8rem', color:!slot.available?'rgba(138,72,88,0.2)':sel?'white':'#8A4858', cursor:slot.available?'pointer':'not-allowed', background:sel?'#1A1218':'white', borderRadius:1, opacity:slot.available?1:0.4, textDecoration:slot.available?'none':'line-through', transition:'all 0.2s' }}>
                            {slot.time}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}

            {actionError && (
              <div style={{ margin:'1rem 0', padding:'0.75rem 1rem', background:'rgba(184,92,56,0.08)', border:'1px solid rgba(184,92,56,0.2)', borderRadius:6, fontSize:'0.85rem', color:'#b85c38', fontFamily:"'DM Mono',monospace" }}>
                {actionError}
              </div>
            )}

            <button onClick={reschedule} disabled={!selDate||!selTherapist||!selTime||submitting}
              style={{ width:'100%', padding:'1rem', background:'#D4899A', color:'white', border:'none', borderRadius:6, fontFamily:"'DM Mono',monospace", fontSize:'0.82rem', letterSpacing:'0.15em', textTransform:'uppercase', cursor:'pointer', opacity:(!selDate||!selTherapist||!selTime||submitting)?0.45:1, marginTop:'1rem' }}>
              {submitting ? 'Rescheduling…' : 'Confirm New Time'}
            </button>
          </>
        )}

        {/* ── CANCELLED ── */}
        {view === 'cancelled' && (
          <div style={{ textAlign:'center', padding:'3rem 1rem' }}>
            <div style={{ fontSize:'3rem', marginBottom:'1.5rem' }}>✓</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'2rem', fontWeight:300, color:'#1A1218', marginBottom:'1rem' }}>Appointment Cancelled</h2>
            <p style={{ color:'#B09098', lineHeight:1.8, marginBottom:'2rem', maxWidth:320, margin:'0 auto 2rem' }}>
              Your appointment has been cancelled. We hope to see you again soon.
            </p>
            <a href="/" style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.82rem', letterSpacing:'0.15em', textTransform:'uppercase', padding:'0.9rem 2.4rem', background:'#D4899A', color:'white', textDecoration:'none', borderRadius:6, display:'inline-block' }}>
              Book Again
            </a>
          </div>
        )}

        {/* ── DONE (rescheduled) ── */}
        {view === 'done' && appt && (
          <div style={{ textAlign:'center', padding:'3rem 1rem' }}>
            <div style={{ fontSize:'3rem', marginBottom:'1.5rem' }}>🌸</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'2rem', fontWeight:300, color:'#1A1218', marginBottom:'1rem' }}>All Rescheduled!</h2>
            <p style={{ color:'#B09098', lineHeight:1.8, marginBottom:'1.5rem' }}>Your new appointment time:</p>
            <div style={{ background:'white', border:'1.5px solid #EDD8DF', borderRadius:8, padding:'1.2rem', marginBottom:'2rem', maxWidth:360, margin:'0 auto 2rem' }}>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.3rem', color:'#1A1218', marginBottom:'0.5rem' }}>{fmt(appt.appointmentAt)}</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', color:'#B09098', textTransform:'uppercase', letterSpacing:'0.1em' }}>{appt.therapist.name} · {appt.service.name}</div>
            </div>
            <a href="/" style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.82rem', letterSpacing:'0.15em', textTransform:'uppercase', padding:'0.9rem 2.4rem', background:'#D4899A', color:'white', textDecoration:'none', borderRadius:6, display:'inline-block' }}>
              Back to Homepage
            </a>
          </div>
        )}
      </div>
    </>
  )
}
