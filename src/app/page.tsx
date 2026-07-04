'use client'
// src/app/page.tsx — Carnation Spa 顾客首页
import { useEffect, useState, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render:      (el: HTMLElement, opts: object) => string
      reset:       (id: string) => void
      getResponse: (id: string) => string | undefined
    }
  }
}

interface Service   { id:string; name:string; description:string|null; durationMin:number; price:string; imageUrl:string|null }
interface Therapist { id:string; name:string; title:string|null; bio:string|null; googleReviewUrl:string|null; bufferMins:number; avatarUrl:string|null }
interface TimeSlot  { time:string; available:boolean }
interface AvailResult { therapistId:string; therapistName:string; slots:TimeSlot[] }

const EMOJIS  = ['🌿','💆','🕯️','🪨','💎','🌸','🧘','✨']
const TAVATAR = ['🧘‍♀️','🌸','💫','🌿','✨','💆']

function getNext30Days() {
  return Array.from({length:30},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()+i); return d })
}

export default function HomePage() {
  const [services,   setServices]   = useState<Service[]>([])
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [open, setOpen]             = useState(false)
  const [step, setStep]             = useState(1)
  const [selService,   setSelService]   = useState<Service|null>(null)
  const [selDate,      setSelDate]      = useState('')
  const [selTherapist, setSelTherapist] = useState('')
  const [selTime,      setSelTime]      = useState('')
  const [avail,        setAvail]        = useState<AvailResult[]>([])
  const [loadingAvail, setLoadingAvail] = useState(false)
  const [name,  setName]  = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [code,  setCode]  = useState('')
  const [codeSent,    setCodeSent]    = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [codeTimer,   setCodeTimer]   = useState(0)
  const [submitting, setSubmitting]   = useState(false)
  const [error,  setError]  = useState('')
  const [addHotStone, setAddHotStone] = useState(false)
  const [scrolled, setScrolled]       = useState(false)
  const [hoveredSvc, setHoveredSvc]   = useState<string|null>(null)
  const [navOpen, setNavOpen]         = useState(false)

  const hotStone     = services.find(s => s.name.toLowerCase().includes('hot stone'))
  const mainServices = services.filter(s => !s.name.toLowerCase().includes('hot stone'))

  // Group by name for display cards
  type ServiceGroup = { rep: Service; variants: Service[]; minPrice: number }
  const displayGroups: ServiceGroup[] = Object.values(
    mainServices.reduce((acc, svc) => {
      const key = svc.name.toLowerCase().trim()
      if (!acc[key]) acc[key] = { rep: svc, variants: [], minPrice: Number(svc.price) }
      acc[key].variants.push(svc)
      if (Number(svc.price) < acc[key].minPrice) { acc[key].minPrice = Number(svc.price); acc[key].rep = svc }
      return acc
    }, {} as Record<string, ServiceGroup>)
  ).map(g => ({ ...g, variants: g.variants.sort((a, b) => a.durationMin - b.durationMin) }))

  // Which group was clicked — drives duration selection inside the drawer
  const [pendingGroup, setPendingGroup] = useState<ServiceGroup | null>(null)
  const timerRef      = useRef<ReturnType<typeof setTimeout>>()
  const tsContainer   = useRef<HTMLDivElement>(null)
  const tsWidgetId    = useRef<string | null>(null)
  const tsToken       = useRef<string>('')
  const days = getNext30Days()

  const [showGallery, setShowGallery] = useState(true)

  useEffect(() => {
    fetch('/api/services').then(r=>r.json()).then(setServices).catch(()=>{})
    fetch('/api/therapists').then(r=>r.json()).then(setTherapists).catch(()=>{})
    fetch('/api/site-config').then(r=>r.json()).then((d: Record<string,string>) => {
      if (d.show_gallery === '0') setShowGallery(false)
    }).catch(()=>{})
  }, [])

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    if (!selDate || !selService) return
    setLoadingAvail(true); setAvail([]); setSelTherapist(''); setSelTime('')
    fetch(`/api/availability?date=${selDate}&serviceId=${selService.id}`)
      .then(r=>r.json()).then(d=>{
        if (!Array.isArray(d)) { setAvail([]); setLoadingAvail(false); return }
        // Filter out past slots on the client using local time
        const now = new Date()
        const todayLocal = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
        const isToday = selDate === todayLocal
        const processed = isToday ? d.map((t: AvailResult) => ({
          ...t,
          slots: t.slots.map((slot: {time:string;available:boolean}) => {
            const [h, m] = slot.time.split(':').map(Number)
            const slotTime = new Date(now); slotTime.setHours(h, m, 0, 0)
            return slotTime <= now ? { ...slot, available: false } : slot
          })
        })) : d
        setAvail(processed); setLoadingAvail(false)
      })
      .catch(()=>setLoadingAvail(false))
  }, [selDate, selService?.id])

  useEffect(() => {
    if (codeTimer<=0) return
    timerRef.current = setTimeout(()=>setCodeTimer(t=>t-1), 1000)
    return ()=>clearTimeout(timerRef.current)
  }, [codeTimer])

  // Restore cooldown timer from localStorage when phone number is entered/changed
  useEffect(() => {
    if (!phone) return
    try {
      const raw = localStorage.getItem('sms_cooldown')
      if (!raw) return
      const { phone: savedPhone, sentAt } = JSON.parse(raw)
      const digits = (p: string) => p.replace(/\D/g, '')
      if (digits(savedPhone) !== digits(phone)) return
      const remaining = Math.ceil((60000 - (Date.now() - sentAt)) / 1000)
      if (remaining > 0) { setCodeTimer(remaining); setCodeSent(true) }
      else localStorage.removeItem('sms_cooldown')
    } catch {}
  }, [phone])

  // Initialize Turnstile invisible widget when user reaches step 3
  useEffect(() => {
    if (step !== 3) return
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!sitekey || !tsContainer.current || tsWidgetId.current) return
    const init = () => {
      if (!window.turnstile || !tsContainer.current || tsWidgetId.current) return
      tsWidgetId.current = window.turnstile.render(tsContainer.current, {
        sitekey,
        size: 'invisible',
        callback:          (token: string) => { tsToken.current = token },
        'expired-callback': ()             => { tsToken.current = '' },
        'error-callback':   ()             => { tsToken.current = '' },
      })
    }
    if (window.turnstile) { init() }
    else {
      const id = setInterval(() => { if (window.turnstile) { init(); clearInterval(id) } }, 100)
      return () => clearInterval(id)
    }
  }, [step])

  function openDrawer()  { setOpen(true);  document.body.style.overflow='hidden' }
  function closeDrawer() { setOpen(false); document.body.style.overflow=''; resetBooking() }
  function resetBooking() {
    setStep(1); setSelService(null); setPendingGroup(null); setSelDate(''); setSelTherapist('')
    setSelTime(''); setAvail([]); setName(''); setPhone(''); setNotes('')
    setCode(''); setCodeSent(false); setError(''); setSendingCode(false); setCodeTimer(0)
    setAddHotStone(false)
  }

  async function sendCode() {
    if (!phone) { setError('Please enter your phone number first'); return }
    setSendingCode(true); setError('')

    try {
      // If Turnstile is configured (production), wait up to 3s for the token
      const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      if (sitekey && process.env.NODE_ENV !== 'development' && !tsToken.current) {
        await new Promise<void>(resolve => {
          let waited = 0
          const poll = setInterval(() => {
            waited += 100
            if (tsToken.current || waited >= 3000) { clearInterval(poll); resolve() }
          }, 100)
        })
      }

      const cfToken = tsToken.current
      // Consume token — reset widget so next send gets a fresh one
      tsToken.current = ''
      if (tsWidgetId.current && window.turnstile) window.turnstile.reset(tsWidgetId.current)

      const res = await fetch('/api/sms/send', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ phone, purpose:'BOOKING', cfToken })
      })
      if (res.ok) {
        setCodeSent(true); setCodeTimer(60)
        localStorage.setItem('sms_cooldown', JSON.stringify({ phone, sentAt: Date.now() }))
      }
      else {
        const d = await res.json()
        setError(d.error==='RATE_LIMITED'?'Too many requests. Wait a moment.':d.error==='BOT_DETECTED'?'Verification failed. Please try again.':'Failed to send code. Check phone number.')
      }
    } catch {
      setError('Failed to send code. Please try again.')
    } finally {
      setSendingCode(false)
    }
  }

  async function confirmBooking() {
    if (!code) { setError('Please enter the verification code'); return }
    setSubmitting(true); setError('')
    const res = await fetch('/api/appointments', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ serviceId:selService!.id, therapistId:selTherapist, customerName:name, customerPhone:phone, date:selDate, time:selTime, notes: [notes, addHotStone?'Add-on: Hot Stone (Free)':''].filter(Boolean).join(' | '), smsCode:code, source:'ONLINE' })
    })
    setSubmitting(false)
    if (res.ok) { setStep(5) }
    else {
      const d = await res.json()
      if (d.error==='TIME_SLOT_TAKEN') setError('That slot was just taken. Please choose another time.')
      else if (d.error==='WRONG_CODE')  setError('Incorrect verification code.')
      else setError('Booking failed. Please try again.')
    }
  }

  const selectedTherapistObj = therapists.find(t=>t.id===selTherapist)

  const inp: React.CSSProperties = { width:'100%', padding:'0.75rem 0.9rem', border:'1.5px solid #EDD8DF', borderRadius:1, background:'white', color:'#1A1218', fontFamily:"'Jost',sans-serif", fontSize:'0.96rem', fontWeight:300, outline:'none', boxSizing:'border-box' }
  const monoLabel: React.CSSProperties = { display:'block', fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'#B09098', marginBottom:'0.45rem' }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html:`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        html{scroll-behavior:smooth}
        body{background:#F3F0EE;color:#1A1218;font-family:'Jost',sans-serif;font-weight:300;overflow-x:hidden;font-size:17px}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#F3F0EE}::-webkit-scrollbar-thumb{background:#DDB8C4;border-radius:2px}
        @keyframes heroReveal{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        @keyframes drift{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-20px)}}
        @keyframes overlayUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @media(min-width:768px){.desktop-nav-item{display:block!important}.hamburger-btn{display:none!important}}
        @media(max-width:767px){.hamburger-btn{display:flex!important}}
      `}} />

      {/* NAV */}
      <nav style={{ position:'fixed',top:0,left:0,right:0,zIndex:100,display:'flex',justifyContent:'space-between',alignItems:'center', padding:scrolled?'1rem 1.5rem':'1.5rem 2rem', background:scrolled?'rgba(243,240,238,0.95)':'rgba(243,240,238,0)', backdropFilter:scrolled?'blur(12px)':'none', borderBottom:scrolled?'1px solid #EDD8DF':'none', transition:'all 0.4s' }}>
        <a href="#" style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:400,letterSpacing:'0.2em',color:scrolled?'#1A1218':'#FFF8FA',textDecoration:'none' }}>Carnation</a>
        {/* Desktop nav */}
        <div style={{ display:'flex',alignItems:'center',gap:'2rem' }}>
          <ul style={{ display:'flex',gap:'2rem',listStyle:'none',margin:0 }}>
            {[['Services','#services'],['Team','#team'],['About','#about']].map(([l,h])=>(
              <li key={l} style={{ display:'none' }} className="desktop-nav-item">
                <a href={h} style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.75rem',letterSpacing:'0.15em',textTransform:'uppercase',color:scrolled?'#8A4858':'rgba(250,246,240,0.8)',textDecoration:'none' }}>{l}</a>
              </li>
            ))}
          </ul>
          <a href="tel:9783300895" style={{ display:'none',fontFamily:"'DM Mono',monospace",fontSize:'0.75rem',letterSpacing:'0.12em',textTransform:'uppercase',color:scrolled?'#8A4858':'rgba(250,246,240,0.8)',textDecoration:'none' }} className="desktop-nav-item">
            (978) 330-0895
          </a>
          <button onClick={openDrawer} style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.75rem',letterSpacing:'0.15em',textTransform:'uppercase',padding:'0.65rem 1.4rem',background:'transparent',border:`1px solid ${scrolled?'#D4899A':'rgba(250,246,240,0.5)'}`,color:scrolled?'#D4899A':'#FFF8FA',cursor:'pointer',borderRadius:1,transition:'all 0.3s' }}>
            Book Now
          </button>
          {/* Hamburger */}
          <button onClick={()=>setNavOpen(o=>!o)} style={{ display:'flex',flexDirection:'column',gap:5,background:'transparent',border:'none',cursor:'pointer',padding:'4px' }} className="hamburger-btn" aria-label="Menu">
            {[0,1,2].map(i=>(
              <span key={i} style={{ display:'block',width:22,height:1.5,background:scrolled?'#1A1218':'#FFF8FA',borderRadius:2,transition:'all 0.3s',transform: navOpen&&i===0?'rotate(45deg) translate(4.5px,4.5px)':navOpen&&i===1?'scaleX(0)':navOpen&&i===2?'rotate(-45deg) translate(4.5px,-4.5px)':'none',opacity:navOpen&&i===1?0:1 }} />
            ))}
          </button>
        </div>
      </nav>

      {/* Mobile nav overlay */}
      {navOpen && (
        <div style={{ position:'fixed',inset:0,zIndex:99,background:'rgba(243,240,238,0.97)',backdropFilter:'blur(8px)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'2.5rem' }}>
          {[['Services','#services'],['Team','#team'],['About','#about']].map(([l,h])=>(
            <a key={l} href={h} onClick={()=>setNavOpen(false)}
              style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'2.5rem',fontWeight:300,color:'#1A1218',textDecoration:'none',letterSpacing:'0.1em' }}>
              {l}
            </a>
          ))}
          <button onClick={()=>{ setNavOpen(false); openDrawer() }}
            style={{ marginTop:'1rem',fontFamily:"'DM Mono',monospace",fontSize:'0.82rem',letterSpacing:'0.2em',textTransform:'uppercase',padding:'1rem 3rem',background:'#D4899A',color:'white',border:'none',cursor:'pointer',borderRadius:1 }}>
            Book Now
          </button>
          <a href="tel:9783300895" style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.78rem',letterSpacing:'0.15em',color:'#B09098',textDecoration:'none' }}>
            (978) 330-0895
          </a>
        </div>
      )}

      {/* HERO */}
      <div style={{ position:'relative',height:'100vh',minHeight:640,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden' }}>
        {/* Background image */}
        <img src="/hero-bg.webp" alt="" aria-hidden="true" style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'center 30%',pointerEvents:'none' }} />
        {/* Overlay */}
        <div style={{ position:'absolute',inset:0,background:'linear-gradient(160deg,rgba(26,18,24,0.62) 0%,rgba(26,18,24,0.38) 50%,rgba(26,18,24,0.65) 100%)' }} />
        {/* Subtle carnation tint at bottom */}
        <div style={{ position:'absolute',bottom:0,left:0,right:0,height:'40%',background:'linear-gradient(to top,rgba(138,72,88,0.25),transparent)',pointerEvents:'none' }} />
        <div style={{ position:'relative',zIndex:2,textAlign:'center',padding:'0 2rem',animation:'heroReveal 1.4s both' }}>
          <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.78rem',letterSpacing:'0.4em',textTransform:'uppercase',color:'rgba(221,184,196,0.85)',marginBottom:'1.8rem' }}>carnation spa · burlington, ma</div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(3.5rem,9vw,8rem)',fontWeight:300,lineHeight:0.95,color:'#FFF8FA',marginBottom:'1.5rem' }}>
            Feel Good,<br/><em style={{ fontStyle:'italic',color:'#DDB8C4' }}>Come Back</em>
          </h1>
          <p style={{ fontFamily:"'Jost',sans-serif",fontSize:'1.1rem',fontWeight:300,color:'rgba(250,246,240,0.75)',letterSpacing:'0.08em',marginBottom:'3rem',maxWidth:460,margin:'0 auto 3rem',lineHeight:1.8 }}>
            Burlington's go-to massage studio — deep tissue, Swedish, prenatal &amp; more. Licensed therapists ready to help.
          </p>
          <div style={{ display:'flex',alignItems:'center',gap:'1rem',flexWrap:'wrap',justifyContent:'center' }}>
            <button onClick={openDrawer} style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.82rem',letterSpacing:'0.18em',textTransform:'uppercase',padding:'1rem 2.8rem',background:'#D4899A',color:'white',border:'none',cursor:'pointer',borderRadius:1,transition:'all 0.35s' }}>Book a Session</button>
            <a href="tel:9783300895" style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',letterSpacing:'0.15em',textTransform:'uppercase',padding:'1rem 1.6rem',background:'transparent',color:'rgba(250,246,240,0.85)',border:'1px solid rgba(250,246,240,0.35)',borderRadius:1,textDecoration:'none' }}>📞 Call</a>
            <a href="sms:9783300895" style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',letterSpacing:'0.15em',textTransform:'uppercase',padding:'1rem 1.6rem',background:'transparent',color:'rgba(250,246,240,0.85)',border:'1px solid rgba(250,246,240,0.35)',borderRadius:1,textDecoration:'none' }}>💬 Text Us</a>
          </div>
        </div>
        <div style={{ position:'absolute',bottom:'2.5rem',left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.5rem' }}>
          <span style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',letterSpacing:'0.2em',textTransform:'uppercase',color:'rgba(250,246,240,0.45)' }}>scroll</span>
          <div style={{ width:1,height:48,background:'linear-gradient(to bottom,rgba(250,246,240,0.4),transparent)' }} />
        </div>
      </div>

      {/* GALLERY */}
      {showGallery && <section style={{ background:'#EDE5E9', padding:'6rem 2rem', borderTop:'1px solid #EDD8DF' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <p style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', letterSpacing:'0.22em', textTransform:'uppercase', color:'#B09098', marginBottom:'1rem', textAlign:'center' }}>Our Space</p>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(2rem,3.5vw,3rem)', fontWeight:300, color:'#1A1218', textAlign:'center', marginBottom:'3rem' }}>A sanctuary for <em style={{ fontStyle:'italic', color:'#D4899A' }}>rest &amp; renewal</em></h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'12px' }}>
            {[1,2,3].map(n=>(
              <div key={n} style={{ aspectRatio:'4/3', overflow:'hidden', borderRadius:2 }}>
                <img src={`/${n}.jpg`} alt={`Carnation Spa ${n}`} style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform 0.5s ease' }}
                  onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.05)')}
                  onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')} />
              </div>
            ))}
          </div>
        </div>
      </section>}

      {/* SERVICES */}
      <section id="services" style={{ background:'#F3F0EE',padding:'7rem 3rem',borderTop:'1px solid #EDD8DF' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'4rem',flexWrap:'wrap',gap:'2rem' }}>
          <div>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.78rem',letterSpacing:'0.35em',textTransform:'uppercase',color:'#B09098',marginBottom:'1rem',display:'flex',alignItems:'center',gap:'1rem' }}>
              <span style={{ display:'block',width:30,height:1,background:'#DDB8C4' }}/> Our Services
            </div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(2.2rem,4vw,3.8rem)',fontWeight:300,lineHeight:1.1,color:'#1A1218' }}>
              Treatments tailored to <em style={{ fontStyle:'italic',color:'#D4899A' }}>how you feel</em>
            </h2>
          </div>
          <button onClick={openDrawer} style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.8rem',letterSpacing:'0.15em',textTransform:'uppercase',padding:'0.8rem 2rem',background:'transparent',border:'1.5px solid #D4899A',color:'#D4899A',cursor:'pointer',borderRadius:1 }}>
            Book Now →
          </button>
        </div>

        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'1.5rem',marginBottom:'4rem' }}>
          {services.length===0 ? [1,2,3,4].map(i=>(
            <div key={i} style={{ background:'#F8EDF0',borderRadius:4,overflow:'hidden',minHeight:340 }}>
              <div style={{ height:220,background:'#EDD8DF' }} />
              <div style={{ padding:'1.4rem' }}>
                <div style={{ height:16,background:'#EDD8DF',borderRadius:2,marginBottom:'0.5rem',width:'70%' }} />
              </div>
            </div>
          )) : [...displayGroups, ...(hotStone ? [{ rep: hotStone, variants: [hotStone], minPrice: 0 }] : [])].map((group)=>{
            const svc = group.rep
            const hovered = hoveredSvc === svc.id
            const isHotStone = svc.name.toLowerCase().includes('hot stone')
            const hasVariants = !isHotStone && group.variants.length > 1
            return (
              <div key={svc.id}
                onClick={()=>{
                  if (isHotStone) { setAddHotStone(true); openDrawer() }
                  else if (hasVariants) { setPendingGroup(group); openDrawer() }
                  else { setSelService(svc); openDrawer() }
                }}
                onMouseEnter={()=>setHoveredSvc(svc.id)}
                onMouseLeave={()=>setHoveredSvc(null)}
                style={{ borderRadius:4,overflow:'hidden',cursor:'pointer',position:'relative',background:'white',border:`1.5px solid ${hovered?'#D4899A':'#EDD8DF'}`,boxShadow:hovered?'0 12px 40px rgba(212,137,154,0.12)':'0 2px 12px rgba(26,18,24,0.04)',transform:hovered?'translateY(-4px)':'translateY(0)',transition:'all 0.35s cubic-bezier(0.16,1,0.3,1)' }}>
                {svc.imageUrl && (
                <div style={{ height:220,overflow:'hidden',position:'relative' }}>
                  <img src={svc.imageUrl} alt={svc.name} style={{ width:'100%',height:'100%',objectFit:'cover',transition:'transform 0.55s ease',transform:hovered?'scale(1.06)':'scale(1)' }} />
                  {isHotStone && (
                    <div style={{ position:'absolute',top:12,left:12,background:'rgba(212,137,154,0.92)',backdropFilter:'blur(4px)',borderRadius:2,padding:'0.2rem 0.6rem',fontFamily:"'DM Mono',monospace",fontSize:'0.62rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'#1A1218',fontWeight:600 }}>
                      Add-on · Complimentary
                    </div>
                  )}
                  <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(26,18,24,0.75) 0%,rgba(26,18,24,0.3) 60%,transparent 100%)',display:'flex',alignItems:'flex-end',padding:'1.2rem',opacity:hovered?1:0,transition:'opacity 0.3s' }}>
                    {hovered && (
                      <p style={{ fontFamily:"'Jost',sans-serif",fontSize:'0.85rem',lineHeight:1.75,color:'rgba(255,255,255,0.95)',margin:0,animation:'overlayUp 0.3s both' }}>
                        {isHotStone ? 'Complimentary add-on with any massage. Click to add it to your booking.' : (svc.description ?? '')}
                      </p>
                    )}
                  </div>
                </div>
                )}
                <div style={{ padding:'1rem 1.2rem' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom: hasVariants?'0.7rem':0 }}>
                    <div>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',fontWeight:400,color:'#1A1218',lineHeight:1.2,marginBottom:'0.15rem' }}>{svc.name}</div>
                      <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.68rem',letterSpacing:'0.1em',color:'#B09098',textTransform:'uppercase' }}>
                        {isHotStone ? 'Pairs with any service' : hasVariants ? 'Select duration below' : svc.durationMin>0?`${svc.durationMin} min`:'—'}
                      </div>
                    </div>
                    <span style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',fontWeight:300,color:isHotStone?'#B09098':'#D4899A',flexShrink:0 }}>
                      {isHotStone ? 'Free' : hasVariants ? `From $${group.minPrice.toFixed(0)}` : `$${Number(svc.price).toFixed(0)}`}
                    </span>
                  </div>
                  {/* Duration chips */}
                  {hasVariants && (
                    <div style={{ display:'flex',gap:'0.4rem',flexWrap:'wrap' }}>
                      {group.variants.map(v => (
                        <span key={v.id} style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.62rem',letterSpacing:'0.08em',padding:'0.2rem 0.55rem',border:'1px solid #EDD8DF',borderRadius:2,color:'#B09098' }}>
                          {v.durationMin} min · ${Number(v.price).toFixed(0)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section style={{ background:'#EDE5E9',padding:'6rem 3rem',borderTop:'1px solid #EDD8DF' }}>
        <div style={{ maxWidth:1100,margin:'0 auto' }}>
          <div style={{ textAlign:'center',marginBottom:'3.5rem' }}>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.78rem',letterSpacing:'0.35em',textTransform:'uppercase',color:'#B09098',marginBottom:'1rem' }}>Why Carnation Spa</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(2rem,4vw,3rem)',fontWeight:300,color:'#1A1218' }}>
              Burlington's <em style={{ fontStyle:'italic',color:'#D4899A' }}>go-to</em> massage studio
            </h2>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'1.5rem' }}>
            {[
              { icon:'🏅', title:'Licensed Therapists', desc:'All therapists are fully licensed in deep tissue, Swedish, prenatal, and trigger point techniques.' },
              { icon:'💪', title:'Therapeutic Focus', desc:'We treat muscle tension, chronic pain, sports injuries, and stress — not just relaxation.' },
              { icon:'📍', title:'Convenient Location', desc:'Easy access in Burlington with ample free parking at 120 Cambridge St.' },
              { icon:'📅', title:'Easy Online Booking', desc:'Book your appointment 24/7 in under 2 minutes — no account required.' },
              { icon:'💰', title:'Transparent Pricing', desc:'No hidden fees. Upfront pricing with options for every budget.' },
              { icon:'⭐', title:'4.9-Star Rated', desc:'Consistently top-rated by over 100 customers on Google and Yelp.' },
            ].map(item => (
              <div key={item.title} style={{ background:'white',border:'1px solid #EDD8DF',borderRadius:2,padding:'1.8rem 1.5rem' }}>
                <div style={{ fontSize:'2rem',marginBottom:'1rem' }}>{item.icon}</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',fontWeight:400,color:'#1A1218',marginBottom:'0.6rem' }}>{item.title}</div>
                <div style={{ fontSize:'0.88rem',lineHeight:1.75,color:'rgba(26,18,24,0.6)' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* THERAPISTS */}
      <section id="team" style={{ background:'#F3F0EE',padding:'7rem 3rem',borderTop:'1px solid #EDD8DF' }}>
        <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.78rem',letterSpacing:'0.35em',textTransform:'uppercase',color:'#B09098',marginBottom:'1rem',display:'flex',alignItems:'center',gap:'1rem' }}>
          <span style={{ display:'block',width:30,height:1,background:'#DDB8C4' }}/> Our Team
        </div>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(2.2rem,4vw,3.8rem)',fontWeight:300,lineHeight:1.1,color:'#1A1218',marginBottom:'4rem' }}>
          Licensed therapists, <em style={{ fontStyle:'italic',color:'#D4899A' }}>clinical training</em>
        </h2>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'2rem' }}>
          {therapists.map((t,i)=>(
            <div key={t.id} style={{ background:'white',border:'1px solid #EDD8DF',borderRadius:2,overflow:'hidden',transition:'all 0.35s' }}
              onMouseEnter={e=>{ const el=e.currentTarget as HTMLDivElement; el.style.borderColor='#D4899A'; el.style.transform='translateY(-4px)'; el.style.boxShadow='0 12px 40px rgba(212,137,154,0.1)' }}
              onMouseLeave={e=>{ const el=e.currentTarget as HTMLDivElement; el.style.borderColor='#EDD8DF'; el.style.transform='translateY(0)'; el.style.boxShadow='none' }}>
              {t.avatarUrl && (
                <div style={{ width:'100%',aspectRatio:'3/4',background:'linear-gradient(160deg,#DDB8C4 0%,#EDD8DF 100%)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'4rem',position:'relative',overflow:'hidden' }}>
                  <img src={t.avatarUrl} alt={t.name} style={{ width:'100%',height:'100%',objectFit:'cover',position:'absolute',inset:0 }} />
                  <div style={{ position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent 60%,rgba(26,18,24,0.25) 100%)' }} />
                </div>
              )}
              <div style={{ padding:'1.5rem' }}>
                <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',fontWeight:400,color:'#1A1218',marginBottom:'0.4rem' }}>{t.name}</div>
                <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'#B09098',marginBottom:'0.8rem' }}>{t.title??'Therapist'}</div>
                <div style={{ fontSize:'0.88rem',lineHeight:1.7,color:'rgba(26,18,24,0.6)',marginBottom:'1.2rem' }}>{t.bio??''}</div>
                {t.googleReviewUrl&&(
                  <a href={t.googleReviewUrl} target="_blank" rel="noreferrer"
                    style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',letterSpacing:'0.1em',color:'#D4899A',textDecoration:'none',textTransform:'uppercase',borderBottom:'1px solid #EDD8DF',paddingBottom:2 }}>
                    ⭐ Google Reviews
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* CTA */}
      <section id="about" style={{ background:'#EDE5E9',textAlign:'center',padding:'8rem 3rem',position:'relative',overflow:'hidden',borderTop:'1px solid #EDD8DF' }}>
        <div style={{ position:'absolute',fontFamily:"'Cormorant Garamond',serif",fontSize:'20vw',fontWeight:300,color:'#F0E8EC',top:'50%',left:'50%',transform:'translate(-50%,-50%)',whiteSpace:'nowrap',pointerEvents:'none',letterSpacing:'0.3em',zIndex:0 }}>CARNATION</div>
        <div style={{ position:'relative',zIndex:1 }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(2.2rem,4vw,3.8rem)',fontWeight:300,lineHeight:1.1,color:'#1A1218',maxWidth:600,margin:'0 auto 2rem' }}>
            Massage therapy <em style={{ fontStyle:'italic',color:'#D4899A' }}>worth the drive</em>
          </h2>
          <p style={{ fontSize:'1.05rem',color:'#B09098',maxWidth:480,margin:'0 auto 3rem',lineHeight:1.9 }}>
            120 Cambridge St, Suite 8 · Burlington, MA 01803<br/>(978) 330-0895
          </p>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:'1rem',flexWrap:'wrap' }}>
            <button onClick={openDrawer} style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.82rem',letterSpacing:'0.18em',textTransform:'uppercase',padding:'1rem 2.8rem',background:'#D4899A',color:'white',border:'none',cursor:'pointer',borderRadius:1 }}>Book Your Session</button>
            <a href="https://maps.google.com/?q=120+Cambridge+St+STE+8+Burlington+MA+01803" target="_blank" rel="noreferrer"
              style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.78rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#B09098',textDecoration:'none',borderBottom:'1px solid #DDB8C4',paddingBottom:2 }}>
              Get Directions ↗
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:'#F3F0EE',padding:'5rem 2.5rem 2.5rem',color:'#B09098',borderTop:'1px solid #EDD8DF' }}>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'3rem',paddingBottom:'3.5rem',borderBottom:'1px solid #EDD8DF',marginBottom:'2rem' }}>
          {/* Brand */}
          <div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:300,color:'#1A1218',letterSpacing:'0.2em',marginBottom:'1rem' }}>Carnation</div>
            <p style={{ fontSize:'0.9rem',lineHeight:1.8,color:'rgba(26,18,24,0.55)',marginBottom:'1.5rem' }}>Therapeutic massage studio in Burlington, MA — deep tissue, Swedish, prenatal &amp; more.</p>
            <div style={{ display:'flex',flexDirection:'column',gap:'0.5rem' }}>
              <a href="tel:9783300895" style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.8rem',color:'#D4899A',textDecoration:'none',letterSpacing:'0.05em' }}>📞 (978) 330-0895</a>
              <a href="sms:9783300895" style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.8rem',color:'rgba(26,18,24,0.4)',textDecoration:'none',letterSpacing:'0.05em' }}>💬 Text to Book</a>
              <span style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.78rem',color:'rgba(26,18,24,0.4)',lineHeight:1.7 }}>120 Cambridge St, Suite 8<br/>Burlington, MA 01803</span>
            </div>
          </div>
          {/* Services */}
          <div>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',letterSpacing:'0.2em',textTransform:'uppercase',color:'rgba(26,18,24,0.35)',marginBottom:'1.2rem' }}>Services</div>
            <ul style={{ listStyle:'none',padding:0 }}>
              {services.slice(0,6).map(s=>(
                <li key={s.id} style={{ marginBottom:'0.65rem' }}>
                  <span style={{ fontSize:'0.9rem',color:'rgba(26,18,24,0.55)',cursor:'pointer',transition:'color 0.2s' }}
                    onClick={openDrawer}
                    onMouseEnter={e=>(e.currentTarget.style.color='#D4899A')}
                    onMouseLeave={e=>(e.currentTarget.style.color='rgba(26,18,24,0.55)')}>
                    {s.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {/* Hours */}
          <div>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',letterSpacing:'0.2em',textTransform:'uppercase',color:'rgba(26,18,24,0.35)',marginBottom:'1.2rem' }}>Hours</div>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.78rem',lineHeight:2,color:'rgba(26,18,24,0.45)' }}>
              Mon – Fri<br/><span style={{ color:'rgba(26,18,24,0.7)' }}>9:00 AM – 9:00 PM</span><br/>
              Sat – Sun<br/><span style={{ color:'rgba(26,18,24,0.7)' }}>9:00 AM – 8:00 PM</span>
            </div>
          </div>
          {/* Book CTA */}
          <div style={{ display:'flex',flexDirection:'column',gap:'0.75rem' }}>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',letterSpacing:'0.2em',textTransform:'uppercase',color:'rgba(26,18,24,0.35)',marginBottom:'0.5rem' }}>Book Now</div>
            <button onClick={openDrawer} style={{ padding:'0.85rem 1.5rem',background:'#D4899A',color:'white',border:'none',borderRadius:1,fontFamily:"'DM Mono',monospace",fontSize:'0.78rem',letterSpacing:'0.15em',textTransform:'uppercase',cursor:'pointer',textAlign:'center' }}>
              Book Online →
            </button>
            <a href="tel:9783300895" style={{ padding:'0.85rem 1.5rem',background:'transparent',color:'rgba(26,18,24,0.55)',border:'1px solid #EDD8DF',borderRadius:1,fontFamily:"'DM Mono',monospace",fontSize:'0.78rem',letterSpacing:'0.15em',textTransform:'uppercase',textDecoration:'none',textAlign:'center' }}>
              Call (978) 330-0895
            </a>
            <a href="sms:9783300895" style={{ padding:'0.85rem 1.5rem',background:'transparent',color:'rgba(26,18,24,0.55)',border:'1px solid #EDD8DF',borderRadius:1,fontFamily:"'DM Mono',monospace",fontSize:'0.78rem',letterSpacing:'0.15em',textTransform:'uppercase',textDecoration:'none',textAlign:'center' }}>
              💬 Text Us
            </a>
          </div>
        </div>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'1rem' }}>
          <span style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.7rem',letterSpacing:'0.1em',color:'rgba(26,18,24,0.3)' }}>© 2025 Carnation Spa LLC. · Burlington, MA</span>
          <span style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.7rem',letterSpacing:'0.08em',color:'rgba(26,18,24,0.3)' }}>
            <a href="/privacy" style={{ color:'rgba(26,18,24,0.3)',textDecoration:'none',borderBottom:'1px solid rgba(26,18,24,0.15)',paddingBottom:1 }}>Privacy Policy</a>
            {' '}&nbsp;·&nbsp;{' '}
            <a href="/terms" style={{ color:'rgba(26,18,24,0.3)',textDecoration:'none',borderBottom:'1px solid rgba(26,18,24,0.15)',paddingBottom:1 }}>Terms &amp; Conditions</a>
          </span>
        </div>
      </footer>

      {/* DRAWER OVERLAY */}
      <div onClick={closeDrawer} style={{ position:'fixed',inset:0,zIndex:500,background:open?'rgba(26,18,24,0.35)':'rgba(26,18,24,0)',backdropFilter:open?'blur(4px)':'none',pointerEvents:open?'all':'none',transition:'background 0.45s,backdrop-filter 0.45s' }} />

      {/* DRAWER PANEL */}
      <div style={{ position:'fixed',top:0,right:0,bottom:0,zIndex:501,width:'min(480px,100vw)',background:'#F3F0EE',transform:open?'translateX(0)':'translateX(100%)',transition:'transform 0.55s cubic-bezier(0.16,1,0.3,1)',display:'flex',flexDirection:'column',overflow:'hidden',fontFamily:"'Jost',sans-serif",borderLeft:'1px solid #EDD8DF' }}>
        {/* Header */}
        <div style={{ padding:'1.8rem 2rem 1.5rem',borderBottom:'1px solid #EDD8DF',display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',fontWeight:300,color:'#2a1820',lineHeight:1.1 }}>
              {step===5?'Booking Confirmed!':'Book a Session'}
            </div>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'#B09098',marginTop:'0.3rem' }}>Carnation Spa · Burlington, MA</div>
          </div>
          <button onClick={closeDrawer} style={{ width:36,height:36,background:'#EDD8DF',border:'none',cursor:'pointer',borderRadius:'50%',fontSize:'1rem',color:'#8A4858',flexShrink:0 }}>✕</button>
        </div>

        {/* Step dots */}
        {step<5&&(
          <div style={{ display:'flex',padding:'1rem 2rem',borderBottom:'1px solid #EDD8DF',flexShrink:0 }}>
            {[['1','Service'],['2','Time'],['3','Details'],['4','Confirm']].map(([n,l],i)=>{
              const s=Number(n),active=step===s,done=step>s
              return (
                <div key={n} style={{ flex:1,display:'flex',alignItems:'center',gap:'0.5rem',opacity:active?1:done?0.55:0.3 }}>
                  <div style={{ width:22,height:22,borderRadius:'50%',border:`1.5px solid ${active?'#2a1820':done?'#B09098':'#DDB8C4'}`,background:active?'#2a1820':done?'#B09098':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Mono',monospace",fontSize:'0.6rem',color:active||done?'white':'#B09098',flexShrink:0,transition:'all 0.3s' }}>
                    {done?'✓':n}
                  </div>
                  <span style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.7rem',letterSpacing:'0.08em',color:'#B09098',whiteSpace:'nowrap' }}>{l}</span>
                  {i<3&&<div style={{ flex:1,height:1,background:'#EDD8DF',margin:'0 0.3rem' }} />}
                </div>
              )
            })}
          </div>
        )}

        {/* Body */}
        <div style={{ flex:1,overflowY:'auto',padding:'1.8rem 2rem' }}>

          {/* Step 1 */}
          {step===1&&(
            <div>
              {pendingGroup ? (
                /* ── Duration selection for a specific service ── */
                <>
                  <button onClick={()=>{ setPendingGroup(null); setSelService(null) }}
                    style={{ display:'flex',alignItems:'center',gap:'0.4rem',fontFamily:"'DM Mono',monospace",fontSize:'0.7rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'#B09098',background:'none',border:'none',cursor:'pointer',marginBottom:'1.2rem',padding:0 }}>
                    ← All services
                  </button>
                  <div style={{ display:'flex',alignItems:'center',gap:'0.8rem',marginBottom:'1.2rem' }}>
                    {pendingGroup.rep.imageUrl && <img src={pendingGroup.rep.imageUrl} alt={pendingGroup.rep.name} style={{ width:44,height:44,objectFit:'cover',borderRadius:4,flexShrink:0 }} />}
                    <div>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',fontWeight:400,color:'#2a1820' }}>{pendingGroup.rep.name}</div>
                      <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.68rem',color:'#B09098',letterSpacing:'0.1em',textTransform:'uppercase',marginTop:'0.15rem' }}>Choose duration</div>
                    </div>
                  </div>
                  <div style={{ display:'flex',flexDirection:'column',gap:'0.6rem' }}>
                    {pendingGroup.variants.map(v=>(
                      <div key={v.id} onClick={()=>{ setSelService(v); setPendingGroup(null) }}
                        style={{ padding:'1.1rem 1.3rem',border:`1.5px solid ${selService?.id===v.id?'#8A4858':'#EDD8DF'}`,borderRadius:2,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',background:selService?.id===v.id?'#F8EDF0':'white',transition:'all 0.2s' }}>
                        <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.82rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'#2a1820' }}>{v.durationMin} min</div>
                        <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',fontWeight:300,color:'#8A4858' }}>${Number(v.price).toFixed(0)}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* ── Full service list ── */
                <>
                  <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#B09098',marginBottom:'1rem' }}>Choose a service</div>
                  <div style={{ display:'flex',flexDirection:'column',gap:'0.75rem' }}>
                    {displayGroups.map(group=>(
                      <div key={group.rep.id} onClick={()=>{ if(group.variants.length>1) { setPendingGroup(group) } else { setSelService(group.rep) } }}
                        style={{ padding:'1.2rem 1.3rem',border:`1.5px solid ${selService&&group.variants.some(v=>v.id===selService.id)?'#8A4858':'#EDD8DF'}`,borderRadius:2,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',background:selService&&group.variants.some(v=>v.id===selService.id)?'#F8EDF0':'white',boxShadow:selService&&group.variants.some(v=>v.id===selService.id)?'0 0 0 3px rgba(138,72,88,0.08)':'none',transition:'all 0.25s' }}>
                        <div style={{ display:'flex',alignItems:'center',gap:'1rem' }}>
                          {group.rep.imageUrl && <img src={group.rep.imageUrl} alt={group.rep.name} style={{ width:40,height:40,objectFit:'cover',borderRadius:4,flexShrink:0 }} />}
                          <div>
                            <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'1.15rem',fontWeight:400,color:'#2a1820' }}>{group.rep.name}</div>
                            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',color:'#B09098',letterSpacing:'0.1em',textTransform:'uppercase',marginTop:'0.2rem' }}>
                              {group.variants.length>1 ? `${group.variants.length} durations` : group.rep.durationMin>0?`${group.rep.durationMin} min`:'—'}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign:'right',flexShrink:0 }}>
                          <span style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',fontWeight:300,color:'#8A4858' }}>
                            {group.variants.length>1?`From $${group.minPrice.toFixed(0)}`:`$${Number(group.rep.price).toFixed(0)}`}
                          </span>
                          {group.variants.length>1 && <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.62rem',color:'#B09098',marginTop:'0.1rem' }}>tap to select →</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Hot Stone add-on — shows once any service is selected */}
              {hotStone && selService && (
                <div style={{ marginTop:'1.5rem' }}>
                  <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#B09098',marginBottom:'0.75rem',display:'flex',alignItems:'center',gap:'0.6rem' }}>
                    <span style={{ display:'block',width:20,height:1,background:'#DDB8C4' }}/> Enhance your session
                  </div>
                  <div onClick={()=>setAddHotStone(v=>!v)}
                    style={{ padding:'1rem 1.2rem',border:`1.5px solid ${addHotStone?'#D4899A':'#EDD8DF'}`,borderRadius:2,cursor:'pointer',display:'flex',alignItems:'center',gap:'1rem',background:addHotStone?'#fdf8f0':'white',transition:'all 0.25s',boxShadow:addHotStone?'0 0 0 3px rgba(212,137,154,0.12)':'none' }}>
                    {/* Checkbox */}
                    <div style={{ width:22,height:22,borderRadius:4,border:`2px solid ${addHotStone?'#D4899A':'#e8b5c5'}`,background:addHotStone?'#D4899A':'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.2s' }}>
                      {addHotStone && <span style={{ color:'white',fontSize:'0.75rem',fontWeight:700,lineHeight:1 }}>✓</span>}
                    </div>
                    {hotStone.imageUrl
                      ? <img src={hotStone.imageUrl} alt="Hot Stone" style={{ width:40,height:40,objectFit:'cover',borderRadius:4,flexShrink:0 }} />
                      : <span style={{ fontSize:'1.4rem' }}>🪨</span>
                    }
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',fontWeight:400,color:'#2a1820' }}>Hot Stone</div>
                      <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.7rem',color:'#B09098',letterSpacing:'0.08em',marginTop:'0.15rem' }}>Heated basalt stones · Complimentary add-on</div>
                    </div>
                    <span style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',fontWeight:300,color:'#B09098',flexShrink:0 }}>Free</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2 */}
          {step===2&&(
            <div>
              <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#B09098',marginBottom:'0.8rem' }}>Select a date</div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.4rem',marginBottom:'1.8rem' }}>
                {days.map((d,i)=>{
                  const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
                  const dow=i===0?'Today':['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]
                  const isWeekend = d.getDay()===0||d.getDay()===6
                  return (
                    <div key={iso} onClick={()=>setSelDate(iso)}
                      style={{ padding:'0.45rem 0.3rem',border:`1.5px solid ${selDate===iso?'#2a1820':'#EDD8DF'}`,fontFamily:"'DM Mono',monospace",fontSize:'0.62rem',color:selDate===iso?'#FFF8FA':isWeekend?'#B09098':'#8A4858',cursor:'pointer',background:selDate===iso?'#2a1820':'white',borderRadius:1,textAlign:'center',transition:'all 0.2s',lineHeight:1.4 }}>
                      <div style={{ opacity:0.7 }}>{dow.slice(0,3)}</div>
                      <div style={{ fontWeight:600,fontSize:'0.75rem' }}>{d.getDate()}</div>
                    </div>
                  )
                })}
              </div>
              {selDate&&(
                <>
                  <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#B09098',marginBottom:'0.8rem' }}>
                    Available times {loadingAvail&&'— loading…'}
                  </div>
                  {!loadingAvail&&avail.length===0&&<div style={{ color:'#B09098',fontSize:'0.9rem',padding:'1rem 0' }}>No availability for this date.</div>}
                  {avail.map((t,ti)=>(
                    <div key={t.therapistId} style={{ marginBottom:'1.5rem' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:'0.8rem',padding:'0.8rem 0',marginBottom:'0.6rem' }}>
                        <div style={{ width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#DDB8C4,#8A4858)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0,overflow:'hidden' }}>
                          {therapists.find(th=>th.id===t.therapistId)?.avatarUrl
                            ? <img src={therapists.find(th=>th.id===t.therapistId)!.avatarUrl!} alt={t.therapistName} style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                            : TAVATAR[ti%TAVATAR.length]
                          }
                        </div>
                        <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',color:'#2a1820' }}>{t.therapistName}</div>
                      </div>
                      <div style={{ display:'flex',flexWrap:'wrap',gap:'0.5rem' }}>
                        {t.slots.map(slot=>{
                          const sel=selTherapist===t.therapistId&&selTime===slot.time
                          return (
                            <div key={slot.time} onClick={()=>{ if(!slot.available)return; setSelTherapist(t.therapistId); setSelTime(slot.time) }}
                              style={{ padding:'0.48rem 0.9rem',border:`1.5px solid ${sel?'#2a1820':'#EDD8DF'}`,fontFamily:"'DM Mono',monospace",fontSize:'0.8rem',color:!slot.available?'rgba(138,72,88,0.2)':sel?'#FFF8FA':'#8A4858',cursor:slot.available?'pointer':'not-allowed',background:sel?'#2a1820':'white',borderRadius:1,textDecoration:slot.available?'none':'line-through',opacity:slot.available?1:0.4,transition:'all 0.2s' }}>
                              {slot.time}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Step 3 */}
          {step===3&&(
            <div>
              {/* Invisible Turnstile widget container */}
              <div ref={tsContainer} style={{ display:'none' }} />
              <div style={{ marginBottom:'1.2rem' }}>
                <label style={monoLabel}>Full Name</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={inp} />
              </div>
              <div style={{ marginBottom:'1.2rem' }}>
                <label style={monoLabel}>Phone Number</label>
                <div style={{ display:'flex',gap:'0.5rem' }}>
                  <input value={phone} onChange={e=>{setPhone(e.target.value);setCodeSent(false)}} placeholder="(xxx) xxx-xxxx" type="tel" style={{...inp,flex:1}} />
                  <button onClick={sendCode} disabled={sendingCode||codeTimer>0}
                    style={{ padding:'0 1rem',background:'#2a1820',color:'#FFF8FA',border:'none',borderRadius:1,fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',letterSpacing:'0.1em',cursor:codeTimer>0?'not-allowed':'pointer',whiteSpace:'nowrap',minWidth:96,opacity:codeTimer>0?0.6:1 }}>
                    {sendingCode?'Sending…':codeTimer>0?`Resend ${codeTimer}s`:codeSent?'Resend':'Send Code'}
                  </button>
                </div>
              </div>
              {codeSent&&(
                <div style={{ marginBottom:'1.2rem' }}>
                  <label style={monoLabel}>Verification Code</label>
                  <input value={code} onChange={e=>setCode(e.target.value)} placeholder="123456" maxLength={6}
                    style={{...inp,fontFamily:"'DM Mono',monospace",fontSize:'1.2rem',letterSpacing:'0.3em'}} />
                </div>
              )}
              <div style={{ marginBottom:'1.2rem' }}>
                <label style={monoLabel}>Notes (optional)</label>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Areas to focus on, allergies, etc."
                  style={{...inp,resize:'vertical'}} />
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step===4&&(
            <div>
              <div style={{ background:'white',border:'1.5px solid #EDD8DF',borderRadius:2,padding:'1.4rem',marginBottom:'1.2rem' }}>
                <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',color:'#2a1820',marginBottom:'1rem',paddingBottom:'0.8rem',borderBottom:'1px solid #EDD8DF' }}>Booking Summary</div>
                {[['Service',selService?.name],['Duration',selService?.durationMin?`${selService.durationMin} min`:'—'],['Add-on',addHotStone?'🪨 Hot Stone (Free)':'—'],['Price',Number(selService?.price??0)===0?'Free':`$${Number(selService?.price??0).toFixed(0)}`],['Therapist',selectedTherapistObj?.name],['Date',selDate?new Date(selDate+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}):''],['Time',selTime],['Name',name],['Phone',phone]].map(([k,v])=>(
                  <div key={k as string} style={{ display:'flex',justifyContent:'space-between',padding:'0.4rem 0',borderBottom:'1px solid #F8EDF0',fontSize:'0.92rem' }}>
                    <span style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.7rem',color:'#B09098',letterSpacing:'0.08em',textTransform:'uppercase' }}>{k}</span>
                    <span style={{ color:'#2a1820',textAlign:'right',maxWidth:'60%' }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:'#F8EDF0',border:'1px solid #EDD8DF',borderRadius:2,padding:'0.9rem 1rem',fontSize:'0.85rem',color:'#B09098',lineHeight:1.7 }}>
                📱 A confirmation SMS will be sent to {phone}
              </div>
            </div>
          )}

          {/* Step 5 */}
          {step===5&&(
            <div style={{ textAlign:'center',padding:'3rem 1rem' }}>
              <div style={{ fontSize:'4rem',marginBottom:'1.5rem' }}>🌸</div>
              <h3 style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:300,color:'#2a1820',marginBottom:'1rem' }}>You're all set!</h3>
              <p style={{ fontSize:'0.95rem',color:'#B09098',lineHeight:1.8,marginBottom:'2rem',maxWidth:320,marginLeft:'auto',marginRight:'auto' }}>
                Your booking is confirmed. Check your SMS for details and a link to manage your appointment.
              </p>
              <div style={{ background:'white',border:'1.5px solid #EDD8DF',borderRadius:2,padding:'1rem 1.4rem',textAlign:'left',marginBottom:'1.5rem' }}>
                <div style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.7rem',color:'#B09098',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'0.5rem' }}>Location</div>
                <div style={{ fontSize:'0.92rem',color:'#8A4858',lineHeight:1.7 }}>120 Cambridge St, Suite 8<br/>Burlington, MA 01803</div>
                <a href="https://maps.google.com/?q=120+Cambridge+St+STE+8+Burlington+MA+01803" target="_blank" rel="noreferrer"
                  style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.72rem',color:'#D4899A',textDecoration:'none',letterSpacing:'0.1em',textTransform:'uppercase',marginTop:'0.5rem',display:'inline-block' }}>
                  Get Directions ↗
                </a>
              </div>
              <button onClick={closeDrawer} style={{ fontFamily:"'DM Mono',monospace",fontSize:'0.82rem',letterSpacing:'0.15em',textTransform:'uppercase',padding:'0.9rem 2.4rem',background:'#2a1820',color:'#FFF8FA',border:'none',cursor:'pointer',borderRadius:1 }}>Close</button>
            </div>
          )}

          {error&&(
            <div style={{ marginTop:'1rem',padding:'0.75rem 1rem',background:'rgba(184,92,56,0.08)',border:'1px solid rgba(184,92,56,0.2)',borderRadius:2,fontSize:'0.85rem',color:'#b85c38',fontFamily:"'DM Mono',monospace" }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {step<5&&(
          <div style={{ padding:'1.2rem 2rem',borderTop:'1px solid #EDD8DF',display:'flex',gap:'0.8rem',flexShrink:0 }}>
            {step>1&&(
              <button onClick={()=>{ setStep(s=>s-1); setError('') }}
                style={{ flex:1,padding:'0.85rem',background:'white',border:'1.5px solid #EDD8DF',borderRadius:1,color:'#B09098',fontFamily:"'DM Mono',monospace",fontSize:'0.8rem',letterSpacing:'0.1em',cursor:'pointer' }}>
                ← Back
              </button>
            )}
            <button
              disabled={(step===1&&!selService)||(step===2&&(!selDate||!selTherapist||!selTime))||(step===3&&(!name||!phone||!codeSent||code.length<4))||submitting}
              onClick={()=>{ if(step<4){setStep(s=>s+1);setError('')} else confirmBooking() }}
              style={{ flex:2,padding:'0.85rem',background:'#2a1820',color:'#FFF8FA',border:'none',borderRadius:1,fontFamily:"'DM Mono',monospace",fontSize:'0.82rem',letterSpacing:'0.15em',textTransform:'uppercase',cursor:'pointer',opacity:((step===1&&!selService)||(step===2&&(!selDate||!selTherapist||!selTime))||(step===3&&(!name||!phone||!codeSent||code.length<4))||submitting)?0.45:1,transition:'opacity 0.2s' }}>
              {submitting?'Confirming…':step===4?'Confirm Booking':'Continue →'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
