'use client'
// src/app/admin/login/page.tsx
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

declare global {
  interface Window {
    turnstileCallback?: (token: string) => void
    turnstile?: { render: (el: HTMLElement, opts: object) => string; reset: (id: string) => void; getResponse: (id: string) => string | undefined }
    _turnstileWidgetId?: string
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [lang, setLang]         = useState<'zh'|'en'>('zh')
  const [cfToken, setCfToken]   = useState('')
  const widgetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!SITE_KEY) return
    window.turnstileCallback = (token: string) => setCfToken(token)
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad'
    script.async = true
    script.defer = true
    ;(window as any).onTurnstileLoad = () => {
      if (widgetRef.current && window.turnstile) {
        window._turnstileWidgetId = (window.turnstile as any).render(widgetRef.current, {
          sitekey: SITE_KEY,
          callback: window.turnstileCallback,
          theme: 'dark',
        })
      }
    }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [])

  async function login() {
    if (!phone || !password) { setError(lang==='zh'?'请填写完整信息':'Fill in all fields'); return }
    if (SITE_KEY && !cfToken) { setError(lang==='zh'?'请完成人机验证':'Please complete the CAPTCHA'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, cfToken }),
      })
      setLoading(false)
      if (res.ok) {
        router.replace('/admin/dashboard')
      } else {
        const data = await res.json()
        if (window._turnstileWidgetId && window.turnstile)
          window.turnstile.reset(window._turnstileWidgetId)
        setCfToken('')
        setError(
          data.error === 'INVALID_CREDENTIALS' ? (lang==='zh' ? '手机号或密码错误' : 'Invalid credentials') :
          data.error === 'RATE_LIMITED'         ? (lang==='zh' ? '尝试次数过多，请15分钟后再试' : 'Too many attempts, try again in 15 min') :
          data.error === 'CAPTCHA_FAILED'       ? (lang==='zh' ? '人机验证失败，请重试' : 'CAPTCHA failed, please retry') :
          (lang==='zh' ? '登录失败，请重试' : 'Login failed')
        )
      }
    } catch {
      setLoading(false)
      setError(lang==='zh' ? '无法连接服务器，请检查网络' : 'Cannot reach server, check your connection')
    }
  }

  const s = {
    page:   { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'radial-gradient(ellipse at 30% 40%, rgba(232,184,109,0.06) 0%, transparent 60%), #0f1117', fontFamily:"'Sora', sans-serif" } as const,
    box:    { background:'#161b27', border:'1px solid #2a3045', borderRadius:16, padding:'2.8rem 2.5rem', width:'min(420px, 92vw)', boxShadow:'0 4px 24px rgba(0,0,0,0.4), 0 0 60px rgba(232,184,109,0.05)' } as const,
    label:  { display:'block', fontSize:'0.72rem', fontWeight:500, color:'#7a8ba8', marginBottom:'0.5rem', letterSpacing:'0.05em', textTransform:'uppercase' as const },
    input:  { width:'100%', padding:'0.75rem 1rem', background:'#1c2333', border:'1px solid #2a3045', borderRadius:6, color:'#e2e8f0', fontSize:'0.9rem', outline:'none', boxSizing:'border-box' as const },
    btn:    { width:'100%', padding:'0.85rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.92rem', fontWeight:600, cursor:'pointer', letterSpacing:'0.03em' },
    error:  { background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:6, padding:'0.6rem 0.9rem', fontSize:'0.8rem', color:'#f87171', marginBottom:'1rem' },
  }

  return (
    <div style={s.page}>
      <div style={s.box}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'2rem' }}>
          <div style={{ width:40, height:40, background:'linear-gradient(135deg,#e8b86d,#c49540)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>🌸</div>
          <div>
            <div style={{ fontWeight:600, fontSize:'1.05rem' }}>Carnation Spa</div>
            <div style={{ fontFamily:'monospace', fontSize:'0.62rem', color:'#7a8ba8', letterSpacing:'0.1em', textTransform:'uppercase' }}>Admin Console</div>
          </div>
        </div>

        {/* Lang toggle */}
        <div style={{ display:'flex', gap:'0.4rem', marginBottom:'1.8rem' }}>
          {(['zh','en'] as const).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{ padding:'0.3rem 0.8rem', fontFamily:'monospace', fontSize:'0.7rem', letterSpacing:'0.08em', border:`1px solid ${lang===l?'#e8b86d':'#2a3045'}`, borderRadius:20, background: lang===l?'#e8b86d':'transparent', color: lang===l?'#0f1117':'#7a8ba8', cursor:'pointer' }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <h2 style={{ fontSize:'1.5rem', fontWeight:500, marginBottom:'0.4rem' }}>{lang==='zh'?'欢迎回来':'Welcome back'}</h2>
        <p style={{ fontSize:'0.85rem', color:'#7a8ba8', marginBottom:'2rem' }}>{lang==='zh'?'请登录以访问管理控制台':'Sign in to access the admin console'}</p>

        {error && <div style={s.error}>{error}</div>}

        <div style={{ marginBottom:'1.2rem' }}>
          <label style={s.label}>{lang==='zh'?'手机号码':'Phone Number'}</label>
          <input style={s.input} type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="+1 (xxx) xxx-xxxx" onKeyDown={e => e.key==='Enter' && login()} />
        </div>
        <div style={{ marginBottom:'1.5rem' }}>
          <label style={s.label}>{lang==='zh'?'密码':'Password'}</label>
          <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" onKeyDown={e => e.key==='Enter' && login()} />
        </div>

        {SITE_KEY && (
          <div style={{ marginBottom:'1.2rem' }}>
            <div ref={widgetRef} />
          </div>
        )}

        <button style={{ ...s.btn, opacity: loading?0.7:1 }} onClick={login} disabled={loading}>
          {loading ? (lang==='zh'?'登录中…':'Signing in…') : (lang==='zh'?'登录控制台':'Sign In')}
        </button>
      </div>
    </div>
  )
}
