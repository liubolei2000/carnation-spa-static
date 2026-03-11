'use client'
// src/app/admin/layout.tsx
import { useEffect, useState, createContext, useContext } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// ─── Auth Context ──────────────────────────────────────
interface Session { accountId: string; role: string; name: string; therapistId: string | null }
const AuthCtx = createContext<Session | null>(null)
export const useAuth = () => useContext(AuthCtx)

// ─── Nav items per role ────────────────────────────────
const NAV = [
  { href: '/admin/dashboard',    icon: '📊', labelZh: '仪表盘',   labelEn: 'Dashboard',   roles: ['OWNER','STAFF'] },
  { href: '/admin/calendar',     icon: '📅', labelZh: '预约日历', labelEn: 'Calendar',    roles: ['OWNER','STAFF'] },
  { href: '/admin/appointments', icon: '📋', labelZh: '预约列表', labelEn: 'Appointments',roles: ['OWNER','STAFF'] },
  { href: '/admin/schedule',     icon: '🗓️', labelZh: '我的日程', labelEn: 'My Schedule', roles: ['THERAPIST'] },
  { href: '/admin/services',     icon: '✨', labelZh: '按摩项目', labelEn: 'Services',    roles: ['OWNER'] },
  { href: '/admin/therapists',   icon: '🧘', labelZh: '技师管理', labelEn: 'Therapists',  roles: ['OWNER'] },
  { href: '/admin/accounts',     icon: '👤', labelZh: '账户权限', labelEn: 'Accounts',    roles: ['OWNER'] },
  { href: '/admin/settings',     icon: '⚙️', labelZh: '网站设置', labelEn: 'Settings',    roles: ['OWNER'] },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [session, setSession]     = useState<Session | null>(null)
  const [loading, setLoading]     = useState(true)
  const [lang, setLang]           = useState<'zh'|'en'>('zh')
  const [isMobile, setIsMobile]   = useState(false)
  const [sidebarOpen, setSidebar] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close sidebar on route change
  useEffect(() => { setSidebar(false) }, [pathname])

  useEffect(() => {
    if (pathname === '/admin/login') { setLoading(false); return }
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { router.replace('/admin/login'); return }
        setSession(data)
        setLoading(false)
      })
      .catch(() => { router.replace('/admin/login') })
  }, [pathname])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/admin/login')
  }

  if (pathname === '/admin/login') return <>{children}</>
  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f1117', color:'#7a8ba8', fontFamily:'monospace' }}>
      Loading…
    </div>
  )

  const visibleNav = NAV.filter(n => session && n.roles.includes(session.role))
  const currentNavItem = visibleNav.find(n => pathname.startsWith(n.href))

  return (
    <AuthCtx.Provider value={session}>
      <div style={{ display:'flex', flexDirection:'column', height:'100vh', fontFamily:"'Sora', sans-serif", background:'#0f1117', color:'#e2e8f0' }}>
        {/* Topbar */}
        <div style={{ height:56, background:'#161b27', borderBottom:'1px solid #2a3045', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1rem', flexShrink:0, gap:'0.5rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', minWidth:0 }}>
            {/* Hamburger — mobile only */}
            {isMobile && (
              <button onClick={() => setSidebar(o => !o)}
                style={{ width:34, height:34, borderRadius:6, background:'transparent', border:'1px solid #2a3045', color:'#94a3b8', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.05rem', flexShrink:0 }}>
                {sidebarOpen ? '✕' : '☰'}
              </button>
            )}
            <div style={{ width:28, height:28, background:'linear-gradient(135deg,#e8b86d,#c49540)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.85rem', flexShrink:0 }}>🌸</div>
            {!isMobile && <span style={{ fontWeight:600, fontSize:'0.95rem', whiteSpace:'nowrap' }}>Carnation Spa</span>}
            {!isMobile && <div style={{ width:1, height:20, background:'#2a3045', flexShrink:0 }}/>}
            <span style={{ fontSize:'0.82rem', color:'#7a8ba8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {currentNavItem?.[lang==='zh'?'labelZh':'labelEn'] ?? (isMobile ? 'Carnation Spa' : 'Admin')}
            </span>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexShrink:0 }}>
            {/* Lang toggle — desktop only */}
            {!isMobile && (
              <div style={{ display:'flex', gap:'0.3rem' }}>
                {(['zh','en'] as const).map(l => (
                  <button key={l} onClick={() => setLang(l)} style={{ padding:'0.2rem 0.6rem', borderRadius:20, border:`1px solid ${lang===l?'#e8b86d':'#2a3045'}`, background: lang===l?'#e8b86d':'transparent', color: lang===l?'#0f1117':'#7a8ba8', fontSize:'0.65rem', fontFamily:'monospace', letterSpacing:'0.08em', cursor:'pointer' }}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.3rem 0.6rem', background:'#1c2333', border:'1px solid #2a3045', borderRadius:20, fontSize:'0.8rem', color:'#7a8ba8' }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#e8b86d,#a78bfa)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.6rem', color:'#0f1117', fontWeight:600, flexShrink:0 }}>
                {session?.name?.[0]?.toUpperCase()}
              </div>
              {!isMobile && <span>{session?.name}</span>}
            </div>
            {!isMobile && (
              <button onClick={logout} style={{ padding:'0.3rem 0.7rem', borderRadius:6, background:'transparent', border:'1px solid #2a3045', color:'#7a8ba8', fontSize:'0.75rem', cursor:'pointer' }}>
                {lang==='zh'?'退出':'Sign Out'}
              </button>
            )}
          </div>
        </div>

        <div style={{ display:'flex', flex:1, overflow:'hidden', position:'relative' }}>
          {/* Mobile backdrop */}
          {isMobile && sidebarOpen && (
            <div onClick={() => setSidebar(false)}
              style={{ position:'fixed', inset:0, top:56, background:'rgba(0,0,0,0.55)', zIndex:40 }} />
          )}

          {/* Sidebar */}
          <div style={{
            width: 220,
            background:'#161b27',
            borderRight:'1px solid #2a3045',
            display:'flex',
            flexDirection:'column',
            flexShrink:0,
            overflowY:'auto',
            ...(isMobile ? {
              position:'fixed',
              top:56,
              bottom:0,
              left:0,
              zIndex:50,
              transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition:'transform 0.22s ease',
            } : {}),
          }}>
            <div style={{ padding:'1rem 0.75rem 0.5rem' }}>
              <div style={{ fontFamily:'monospace', fontSize:'0.62rem', letterSpacing:'0.15em', textTransform:'uppercase', color:'#3d4f6e', padding:'0 0.5rem', marginBottom:'0.5rem' }}>
                {lang==='zh'?'菜单':'MENU'}
              </div>
              {visibleNav.map(item => {
                const active = pathname.startsWith(item.href)
                return (
                  <button key={item.href}
                    onClick={() => { router.push(item.href); if (isMobile) setSidebar(false) }}
                    style={{ display:'flex', alignItems:'center', gap:'0.65rem', padding:'0.55rem 0.75rem', borderRadius:6, fontSize:'0.85rem', color: active?'#e8b86d':'#7a8ba8', cursor:'pointer', border:'none', background: active?'rgba(232,184,109,0.1)':'transparent', width:'100%', textAlign:'left', transition:'all 0.15s', marginBottom:2 }}>
                    <span style={{ fontSize:'1rem', width:18, textAlign:'center' }}>{item.icon}</span>
                    <span>{lang==='zh'?item.labelZh:item.labelEn}</span>
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop:'auto', padding:'0.75rem', borderTop:'1px solid #2a3045' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.5rem 0.6rem', borderRadius:6, background:'#1c2333', border:'1px solid #2a3045' }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'#6dbf8e', flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'0.8rem', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{session?.name}</div>
                  <div style={{ fontSize:'0.72rem', color:'#7a8ba8' }}>
                    {session?.role === 'OWNER' ? (lang==='zh'?'店主':'Owner') : session?.role === 'STAFF' ? (lang==='zh'?'前台':'Staff') : (lang==='zh'?'技师':'Therapist')}
                  </div>
                </div>
              </div>
              {/* Lang toggle inside sidebar on mobile */}
              {isMobile && (
                <div style={{ display:'flex', gap:'0.4rem', marginTop:'0.5rem' }}>
                  {(['zh','en'] as const).map(l => (
                    <button key={l} onClick={() => setLang(l)} style={{ flex:1, padding:'0.35rem', borderRadius:6, border:`1px solid ${lang===l?'#e8b86d':'#2a3045'}`, background: lang===l?'#e8b86d':'transparent', color: lang===l?'#0f1117':'#7a8ba8', fontSize:'0.7rem', fontFamily:'monospace', cursor:'pointer' }}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
              {/* Logout inside sidebar on mobile */}
              {isMobile && (
                <button onClick={logout} style={{ width:'100%', marginTop:'0.4rem', padding:'0.45rem', background:'transparent', border:'1px solid rgba(248,113,113,0.25)', borderRadius:6, color:'#f87171', fontSize:'0.78rem', cursor:'pointer' }}>
                  {lang==='zh'?'退出登录':'Sign Out'}
                </button>
              )}
            </div>
          </div>

          {/* Page content */}
          <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '1rem' : '1.5rem', background:'#0f1117' }}>
            {children}
          </div>
        </div>
      </div>
    </AuthCtx.Provider>
  )
}
