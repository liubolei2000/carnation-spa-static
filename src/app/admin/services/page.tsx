'use client'
// src/app/admin/services/page.tsx
import { useEffect, useRef, useState } from 'react'

interface Service {
  id: string; name: string; description: string | null
  durationMin: number; price: string; isActive: boolean; sortOrder: number
  imageUrl: string | null
}

const EMOJIS = ['🌿','💆','🕯️','🪨','💎','🌸','🧘','✨','🌊','🔥']

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<Partial<Service> | null>(null)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState('')
  const [lang, setLang]         = useState<'zh'|'en'>('zh')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const T = {
    title:  lang==='zh' ? '按摩项目' : 'Services',
    sub:    lang==='zh' ? '管理所有服务项目' : 'Manage all service offerings',
    add:    lang==='zh' ? '＋ 添加项目' : '＋ Add Service',
    edit:   lang==='zh' ? '编辑' : 'Edit',
    on:     lang==='zh' ? '上架' : 'Enable',
    off:    lang==='zh' ? '下架' : 'Disable',
    active: lang==='zh' ? '上架中' : 'Active',
    inactive: lang==='zh' ? '已下架' : 'Hidden',
    save:   lang==='zh' ? '确认保存' : 'Save',
    cancel: lang==='zh' ? '取消' : 'Cancel',
    editTitle: lang==='zh' ? '编辑项目' : 'Edit Service',
    addTitle:  lang==='zh' ? '添加项目' : 'New Service',
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    fetch('/api/services?all=1').then(r => r.json()).then(data => { setServices(Array.isArray(data)?data:[]); setLoading(false) })
  }, [])

  async function uploadImage(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (res.ok) {
      setModal(m => ({ ...m, imageUrl: data.url }))
    } else {
      showToast(lang==='zh' ? '图片上传失败' : 'Upload failed')
    }
  }

  async function save() {
    if (!modal?.name || !modal?.durationMin || !modal?.price) {
      showToast(lang==='zh'?'请填写完整信息':'Fill in all required fields'); return
    }
    setSaving(true)
    const isNew = !modal.id
    const res = await fetch(isNew ? '/api/services' : `/api/services/${modal.id}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modal),
    })
    const saved = await res.json()
    setSaving(false)
    if (res.ok) {
      if (isNew) setServices(prev => [...prev, saved])
      else setServices(prev => prev.map(s => s.id === saved.id ? saved : s))
      setModal(null); showToast(lang==='zh'?(isNew?'项目已添加 ✓':'已保存 ✓'):(isNew?'Service added ✓':'Saved ✓'))
    } else { showToast(lang==='zh'?'保存失败':'Save failed') }
  }

  async function deleteService(svc: Service) {
    const res = await fetch(`/api/services/${svc.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      setServices(prev => prev.filter(s => s.id !== svc.id))
      showToast(lang==='zh' ? '已删除 ✓' : 'Deleted ✓')
    } else if (data.error === 'HAS_APPOINTMENTS') {
      showToast(lang==='zh' ? `无法删除：有 ${data.count} 条关联预约` : `Cannot delete: ${data.count} linked appointments`)
    } else {
      showToast(lang==='zh' ? '删除失败' : 'Delete failed')
    }
    setDeleting(null)
  }

  async function toggleActive(svc: Service) {
    const res = await fetch(`/api/services/${svc.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !svc.isActive }),
    })
    if (res.ok) {
      setServices(prev => prev.map(s => s.id === svc.id ? { ...s, isActive: !s.isActive } : s))
      showToast(svc.isActive ? (lang==='zh'?'已下架':'Hidden') : (lang==='zh'?'已上架':'Now active'))
    }
  }

  const inp: React.CSSProperties = { width:'100%', padding:'0.75rem 1rem', background:'#1c2333', border:'1px solid #2a3045', borderRadius:6, color:'#e2e8f0', fontSize:'0.9rem', outline:'none', boxSizing:'border-box' }
  const lbl: React.CSSProperties = { display:'block', fontSize:'0.72rem', fontWeight:500, color:'#7a8ba8', marginBottom:'0.5rem', letterSpacing:'0.05em', textTransform:'uppercase' }

  if (loading) return <div style={{ color:'#7a8ba8', fontSize:'0.85rem' }}>{lang==='zh'?'加载中…':'Loading…'}</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:600 }}>{T.title}</h1>
          <div style={{ fontSize:'0.82rem', color:'#7a8ba8', marginTop:'0.2rem' }}>{T.sub}</div>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          <div style={{ display:'flex', gap:'0.3rem' }}>
            {(['zh','en'] as const).map(l => (
              <button key={l} onClick={()=>setLang(l)} style={{ padding:'0.2rem 0.5rem', borderRadius:10, border:`1px solid ${lang===l?'#e8b86d':'#2a3045'}`, background:lang===l?'#e8b86d':'transparent', color:lang===l?'#0f1117':'#7a8ba8', fontSize:'0.6rem', fontFamily:'monospace', cursor:'pointer' }}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={() => setModal({ isActive: true, sortOrder: services.length })}
            style={{ padding:'0.5rem 1rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
            {T.add}
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'1rem' }}>
        {services.map((svc, i) => (
          <div key={svc.id} style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, overflow:'hidden', opacity: svc.isActive ? 1 : 0.6, transition:'opacity 0.2s' }}>
            <div style={{ height:120, background:'linear-gradient(135deg,#161b27,#1c2333)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.8rem', position:'relative', borderBottom:'1px solid #2a3045', overflow:'hidden' }}>
              {svc.imageUrl
                ? <img src={svc.imageUrl} alt={svc.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : EMOJIS[i % EMOJIS.length]
              }
              <span style={{ position:'absolute', top:8, right:8, padding:'0.15rem 0.5rem', borderRadius:4, fontFamily:'monospace', fontSize:'0.6rem', background: svc.isActive?'rgba(109,191,142,0.2)':'rgba(248,113,113,0.2)', color: svc.isActive?'#6dbf8e':'#f87171' }}>
                {svc.isActive ? T.active : T.inactive}
              </span>
            </div>
            <div style={{ padding:'1rem 1.1rem' }}>
              <div style={{ fontSize:'0.95rem', fontWeight:500, marginBottom:'0.4rem' }}>{svc.name}</div>
              <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.6rem' }}>
                <span style={{ fontFamily:'monospace', fontSize:'0.62rem', background:'#161b27', border:'1px solid #2a3045', padding:'0.1rem 0.45rem', borderRadius:4, color:'#7a8ba8' }}>{svc.durationMin} min</span>
                <span style={{ fontSize:'1rem', fontWeight:600, color:'#e8b86d', marginLeft:'auto' }}>${Number(svc.price).toFixed(0)}</span>
              </div>
              <div style={{ fontSize:'0.78rem', color:'#7a8ba8', lineHeight:1.6, marginBottom:'0.8rem', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                {svc.description || (lang==='zh'?'暂无描述':'No description')}
              </div>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={() => setModal(svc)} style={{ flex:1, padding:'0.4rem', background:'transparent', border:'1px solid #2a3045', borderRadius:5, color:'#7a8ba8', fontSize:'0.75rem', cursor:'pointer' }}>{T.edit}</button>
                <button onClick={() => toggleActive(svc)} style={{ flex:1, padding:'0.4rem', background:'transparent', border:`1px solid ${svc.isActive?'rgba(248,113,113,0.3)':'rgba(109,191,142,0.3)'}`, borderRadius:5, color: svc.isActive?'#f87171':'#6dbf8e', fontSize:'0.75rem', cursor:'pointer' }}>
                  {svc.isActive ? T.off : T.on}
                </button>
                <button onClick={() => setDeleting(svc.id)} style={{ padding:'0.4rem 0.6rem', background:'transparent', border:'1px solid rgba(248,113,113,0.3)', borderRadius:5, color:'#f87171', fontSize:'0.75rem', cursor:'pointer' }}>🗑</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Add Modal */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#161b27', border:'1px solid #2a3045', borderRadius:12, width:'min(480px,94vw)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)', maxHeight:'90vh', overflow:'auto' }}>
            <div style={{ padding:'1.2rem 1.4rem', borderBottom:'1px solid #2a3045', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#161b27' }}>
              <span style={{ fontWeight:600 }}>{modal.id ? T.editTitle : T.addTitle}</span>
              <button onClick={() => setModal(null)} style={{ width:28, height:28, borderRadius:'50%', background:'#1c2333', border:'1px solid #2a3045', color:'#7a8ba8', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:'1.4rem', display:'flex', flexDirection:'column', gap:'1rem' }}>

              {/* Image upload */}
              <div>
                <label style={lbl}>{lang==='zh'?'项目图片':'Service Image'}</label>
                <div style={{ borderRadius:8, overflow:'hidden', border:'1px solid #2a3045', marginBottom:'0.6rem', height:140, background:'#1c2333', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                  {modal.imageUrl
                    ? <img src={modal.imageUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <span style={{ fontSize:'3rem', opacity:0.4 }}>🌿</span>
                  }
                </div>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f) }} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    style={{ padding:'0.4rem 0.9rem', background:'transparent', border:'1px solid #2a3045', borderRadius:5, color:'#7a8ba8', fontSize:'0.78rem', cursor:'pointer', opacity:uploading?0.5:1 }}>
                    {uploading ? (lang==='zh'?'上传中…':'Uploading…') : (lang==='zh'?'上传图片':'Upload image')}
                  </button>
                  {modal.imageUrl && (
                    <button onClick={() => setModal(m => ({...m, imageUrl: null}))}
                      style={{ padding:'0.4rem 0.9rem', background:'transparent', border:'1px solid rgba(248,113,113,0.3)', borderRadius:5, color:'#f87171', fontSize:'0.78rem', cursor:'pointer' }}>
                      {lang==='zh'?'移除图片':'Remove'}
                    </button>
                  )}
                </div>
                <div style={{ fontSize:'0.7rem', color:'#7a8ba8', marginTop:'0.4rem' }}>JPG / PNG / WebP，最大 5MB</div>
              </div>

              <div>
                <label style={lbl}>{lang==='zh'?'项目名称':'Service Name'} *</label>
                <input value={modal.name??''} onChange={e => setModal(m => ({...m, name:e.target.value}))} placeholder="e.g. Classic Full Body" style={inp} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.8rem' }}>
                <div>
                  <label style={lbl}>{lang==='zh'?'时长（分钟）':'Duration (min)'} *</label>
                  <input value={modal.durationMin??''} onChange={e => setModal(m => ({...m, durationMin:Number(e.target.value)}))} type="number" placeholder="60" style={inp} />
                </div>
                <div>
                  <label style={lbl}>{lang==='zh'?'价格（$）':'Price ($)'} *</label>
                  <input value={modal.price??''} onChange={e => setModal(m => ({...m, price:e.target.value}))} type="number" placeholder="75" style={inp} />
                </div>
              </div>
              <div>
                <label style={lbl}>{lang==='zh'?'介绍文字':'Description'}</label>
                <textarea value={modal.description??''} onChange={e => setModal(m => ({...m, description:e.target.value}))} rows={3} placeholder={lang==='zh'?'服务描述…':'Service description…'} style={{...inp, resize:'vertical'}} />
              </div>
              <div>
                <label style={lbl}>{lang==='zh'?'排序（数字越小越靠前）':'Sort Order'}</label>
                <input value={modal.sortOrder??0} onChange={e => setModal(m => ({...m, sortOrder:Number(e.target.value)}))} type="number" style={inp} />
              </div>
            </div>
            <div style={{ padding:'1rem 1.4rem', borderTop:'1px solid #2a3045', display:'flex', gap:'0.6rem', justifyContent:'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding:'0.6rem 1.2rem', background:'transparent', border:'1px solid #2a3045', borderRadius:6, color:'#7a8ba8', fontSize:'0.83rem', cursor:'pointer' }}>{T.cancel}</button>
              <button onClick={save} disabled={saving} style={{ padding:'0.6rem 1.4rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.83rem', fontWeight:600, cursor:'pointer', opacity:saving?0.7:1 }}>
                {saving ? (lang==='zh'?'保存中…':'Saving…') : T.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (() => {
        const svc = services.find(s => s.id === deleting)!
        return (
          <div onClick={() => setDeleting(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background:'#161b27', border:'1px solid rgba(248,113,113,0.3)', borderRadius:12, width:'min(380px,90vw)', padding:'1.6rem', boxShadow:'0 4px 24px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize:'1rem', fontWeight:600, marginBottom:'0.5rem' }}>{lang==='zh'?'确认删除':'Confirm Delete'}</div>
              <div style={{ fontSize:'0.85rem', color:'#7a8ba8', marginBottom:'1.2rem' }}>
                {lang==='zh' ? `确定要删除「${svc.name}」吗？此操作不可撤销。` : `Delete "${svc.name}"? This cannot be undone.`}
              </div>
              <div style={{ display:'flex', gap:'0.6rem', justifyContent:'flex-end' }}>
                <button onClick={() => setDeleting(null)} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid #2a3045', borderRadius:6, color:'#7a8ba8', fontSize:'0.82rem', cursor:'pointer' }}>{lang==='zh'?'取消':'Cancel'}</button>
                <button onClick={() => deleteService(svc)} style={{ padding:'0.5rem 1rem', background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.4)', borderRadius:6, color:'#f87171', fontSize:'0.82rem', fontWeight:600, cursor:'pointer' }}>{lang==='zh'?'确认删除':'Delete'}</button>
              </div>
            </div>
          </div>
        )
      })()}

      <div style={{ position:'fixed', bottom:'1.5rem', right:'1.5rem', background:'#1c2333', border:'1px solid #2a3045', borderLeft:'3px solid #6dbf8e', borderRadius:6, padding:'0.75rem 1.2rem', fontSize:'0.82rem', transition:'all 0.3s', opacity:toast?1:0, transform:toast?'translateY(0)':'translateY(60px)', pointerEvents:'none', zIndex:600 }}>
        {toast}
      </div>
    </div>
  )
}
