'use client'
// src/app/admin/accounts/page.tsx
import { useEffect, useState } from 'react'

interface Account { id:string; name:string; phone:string; role:string; isActive:boolean; therapistId:string|null }
interface Therapist { id:string; name:string }

const ROLE_STYLE: Record<string,{bg:string;color:string}> = {
  OWNER:     { bg:'rgba(232,184,109,0.15)', color:'#e8b86d' },
  STAFF:     { bg:'rgba(96,165,250,0.15)',  color:'#60a5fa' },
  THERAPIST: { bg:'rgba(109,191,142,0.15)', color:'#6dbf8e' },
}
const ROLE_LABEL: Record<string,string> = { OWNER:'店主', STAFF:'前台', THERAPIST:'技师' }

export default function AccountsPage() {
  const [accounts, setAccounts]     = useState<Account[]>([])
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState<(Partial<Account> & {password?:string}) | null>(null)
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState('')
  const [myId, setMyId]             = useState('')

  const showToast = (msg:string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    Promise.all([
      fetch('/api/accounts').then(r => r.json()),
      fetch('/api/therapists').then(r => r.json()),
      fetch('/api/auth/me').then(r => r.json()),
    ]).then(([a, t, m]) => {
      setAccounts(Array.isArray(a) ? a : [])
      setTherapists(Array.isArray(t) ? t : [])
      setMyId(m?.accountId ?? '')
      setLoading(false)
    })
  }, [])

  async function save() {
    if (!modal?.name || !modal?.phone) { showToast('请填写完整信息'); return }
    setSaving(true)
    const isNew = !modal.id
    const url  = isNew ? '/api/accounts' : `/api/accounts/${modal.id}`
    const body = isNew
      ? { name:modal.name, phone:modal.phone, password:modal.password, role:modal.role??'STAFF', therapistId:modal.therapistId }
      : { name:modal.name, role:modal.role, isActive:modal.isActive, therapistId:modal.therapistId, ...(modal.password ? {password:modal.password} : {}) }
    const res = await fetch(url, { method:isNew?'POST':'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    const saved = await res.json()
    setSaving(false)
    if (res.ok) {
      if (isNew) setAccounts(p => [...p, {...saved, isActive:true}])
      else setAccounts(p => p.map(a => a.id===saved.id ? {...a,...saved} : a))
      setModal(null); showToast(isNew ? '账户已创建 ✓' : '已保存 ✓')
    } else showToast(saved.error ?? '保存失败')
  }

  const inp: React.CSSProperties = { width:'100%', padding:'0.75rem 1rem', background:'#1c2333', border:'1px solid #2a3045', borderRadius:6, color:'#e2e8f0', fontSize:'0.9rem', outline:'none', boxSizing:'border-box' }
  const lbl: React.CSSProperties = { display:'block', fontSize:'0.72rem', fontWeight:500, color:'#7a8ba8', marginBottom:'0.5rem', letterSpacing:'0.05em', textTransform:'uppercase' }

  if (loading) return <div style={{ color:'#7a8ba8' }}>加载中…</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:600 }}>账户权限</h1>
          <div style={{ fontSize:'0.82rem', color:'#7a8ba8', marginTop:'0.2rem' }}>管理员工登录账户与权限分配</div>
        </div>
        <button onClick={() => setModal({ role:'STAFF', isActive:true })}
          style={{ padding:'0.5rem 1rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
          ＋ 创建账户
        </button>
      </div>

      <div style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, overflow:'hidden' }}>
        {accounts.map((acc, i) => {
          const isSelf = myId === acc.id
          const st = ROLE_STYLE[acc.role] ?? ROLE_STYLE.STAFF
          return (
            <div key={acc.id} style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'0.9rem 1rem', borderBottom: i<accounts.length-1 ? '1px solid rgba(42,48,69,0.5)' : 'none' }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#2a3045,#1c2333)', border:'1px solid #2a3045', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0 }}>
                {acc.role==='OWNER'?'👑':acc.role==='STAFF'?'👩‍💼':'🧘'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'0.88rem', fontWeight:500 }}>
                  {acc.name} {isSelf && <span style={{ fontSize:'0.65rem', color:'#7a8ba8' }}>(你)</span>}
                </div>
                <div style={{ fontFamily:'monospace', fontSize:'0.7rem', color:'#7a8ba8' }}>{acc.phone}</div>
              </div>
              {!acc.isActive && (
                <span style={{ fontSize:'0.65rem', fontFamily:'monospace', color:'#f87171', background:'rgba(248,113,113,0.1)', padding:'0.1rem 0.4rem', borderRadius:4 }}>已停用</span>
              )}
              <span style={{ padding:'0.18rem 0.6rem', borderRadius:20, fontFamily:'monospace', fontSize:'0.62rem', letterSpacing:'0.05em', background:st.bg, color:st.color, flexShrink:0 }}>
                {ROLE_LABEL[acc.role]}
              </span>
              <button onClick={() => !isSelf && setModal(acc)} disabled={isSelf}
                style={{ padding:'0.3rem 0.7rem', borderRadius:5, background:'transparent', border:'1px solid #2a3045', color:isSelf?'#3d4f6e':'#7a8ba8', fontSize:'0.75rem', cursor:isSelf?'default':'pointer', opacity:isSelf?0.4:1, flexShrink:0 }}>
                编辑
              </button>
            </div>
          )
        })}
      </div>

      {modal && (
        <div onClick={() => setModal(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#161b27', border:'1px solid #2a3045', borderRadius:12, width:'min(460px,94vw)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
            <div style={{ padding:'1.2rem 1.4rem', borderBottom:'1px solid #2a3045', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:600 }}>{modal.id ? '编辑账户' : '创建账户'}</span>
              <button onClick={() => setModal(null)} style={{ width:28, height:28, borderRadius:'50%', background:'#1c2333', border:'1px solid #2a3045', color:'#7a8ba8', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:'1.4rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div>
                <label style={lbl}>姓名</label>
                <input value={modal.name??''} onChange={e => setModal(m => ({...m,name:e.target.value}))} placeholder="Full name" style={inp} />
              </div>
              {!modal.id && (
                <div>
                  <label style={lbl}>手机号</label>
                  <input value={modal.phone??''} onChange={e => setModal(m => ({...m,phone:e.target.value}))} placeholder="+1 (xxx) xxx-xxxx" type="tel" style={inp} />
                </div>
              )}
              <div>
                <label style={lbl}>{modal.id ? '新密码（留空不修改）' : '初始密码'}</label>
                <input value={modal.password??''} onChange={e => setModal(m => ({...m,password:e.target.value}))} type="password" placeholder="••••••••" style={inp} />
              </div>
              <div>
                <label style={lbl}>角色</label>
                <select value={modal.role??'STAFF'} onChange={e => setModal(m => ({...m,role:e.target.value}))} style={{...inp, color:'#94a3b8'}}>
                  <option value="STAFF">前台 Staff</option>
                  <option value="THERAPIST">技师 Therapist</option>
                </select>
              </div>
              {modal.role === 'THERAPIST' && (
                <div>
                  <label style={lbl}>关联技师档案</label>
                  <select value={modal.therapistId??''} onChange={e => setModal(m => ({...m,therapistId:e.target.value||null}))} style={{...inp, color:'#94a3b8'}}>
                    <option value="">— 不关联 —</option>
                    {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              {modal.id && (
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', background:'rgba(248,113,113,0.05)', border:'1px solid rgba(248,113,113,0.15)', borderRadius:6 }}>
                  <span style={{ fontSize:'0.82rem', color:'#7a8ba8', flex:1 }}>账户状态：{modal.isActive ? '正常' : '已停用'}</span>
                  <button onClick={() => setModal(m => ({...m, isActive:!m?.isActive}))}
                    style={{ padding:'0.3rem 0.8rem', borderRadius:5, border:`1px solid ${modal.isActive?'rgba(248,113,113,0.3)':'rgba(109,191,142,0.3)'}`, background:'transparent', color:modal.isActive?'#f87171':'#6dbf8e', fontSize:'0.78rem', cursor:'pointer' }}>
                    {modal.isActive ? '停用' : '启用'}
                  </button>
                </div>
              )}
            </div>
            <div style={{ padding:'1rem 1.4rem', borderTop:'1px solid #2a3045', display:'flex', gap:'0.6rem', justifyContent:'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding:'0.6rem 1.2rem', background:'transparent', border:'1px solid #2a3045', borderRadius:6, color:'#7a8ba8', fontSize:'0.83rem', cursor:'pointer' }}>取消</button>
              <button onClick={save} disabled={saving} style={{ padding:'0.6rem 1.4rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.83rem', fontWeight:600, cursor:'pointer' }}>
                {saving ? '保存中…' : '确认保存'}
              </button>
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
