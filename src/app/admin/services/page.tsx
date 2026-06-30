'use client'
// src/app/admin/services/page.tsx
import { useEffect, useRef, useState } from 'react'

interface Service {
  id: string; name: string; description: string | null
  durationMin: number; price: string; isActive: boolean; sortOrder: number
  imageUrl: string | null
}

interface ServiceGroup {
  name: string
  description: string | null
  imageUrl: string | null
  variants: Service[]
}

export default function ServicesPage() {
  const [services, setServices]   = useState<Service[]>([])
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Group modal — edit name / description / image for a whole group
  const [groupModal, setGroupModal] = useState<{ name: string; description: string | null; imageUrl: string | null } | null>(null)
  const [groupOrigName, setGroupOrigName] = useState('')

  // Variant modal — add or edit a single duration+price entry
  const [varModal, setVarModal]     = useState<Partial<Service> | null>(null)
  const [varGroupName, setVarGroupName] = useState('')
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    fetch('/api/services?all=1').then(r => r.json()).then(d => { setServices(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  // ── Group services by name ─────────────────────────────────
  const groups: ServiceGroup[] = Object.values(
    services.reduce((acc, svc) => {
      const key = svc.name.toLowerCase().trim()
      if (!acc[key]) acc[key] = { name: svc.name, description: svc.description, imageUrl: svc.imageUrl, variants: [] }
      acc[key].variants.push(svc)
      return acc
    }, {} as Record<string, ServiceGroup>)
  ).map(g => ({ ...g, variants: g.variants.sort((a, b) => a.durationMin - b.durationMin) }))

  // ── Image upload ───────────────────────────────────────────
  async function uploadImage(file: File): Promise<string | null> {
    setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (res.ok) return data.url
    showToast('图片上传失败'); return null
  }

  // ── Save group edits (update name/description/image on all variants) ──
  async function saveGroup() {
    if (!groupModal?.name) return
    setSaving(true)
    const targets = services.filter(s => s.name.toLowerCase().trim() === groupOrigName.toLowerCase().trim())
    await Promise.all(targets.map(s =>
      fetch(`/api/services/${s.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupModal.name, description: groupModal.description, imageUrl: groupModal.imageUrl }),
      })
    ))
    setServices(prev => prev.map(s =>
      s.name.toLowerCase().trim() === groupOrigName.toLowerCase().trim()
        ? { ...s, name: groupModal.name!, description: groupModal.description ?? null, imageUrl: groupModal.imageUrl ?? null }
        : s
    ))
    setSaving(false); setGroupModal(null); showToast('已保存 ✓')
  }

  // ── Save variant (add or edit duration+price) ──────────────
  async function saveVariant() {
    if (!varModal?.durationMin || !varModal?.price) { showToast('请填写时长和价格'); return }
    setSaving(true)
    const group = groups.find(g => g.name.toLowerCase().trim() === varGroupName.toLowerCase().trim())
    if (varModal.id) {
      const res = await fetch(`/api/services/${varModal.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMin: Number(varModal.durationMin), price: Number(varModal.price), isActive: varModal.isActive }),
      })
      if (res.ok) {
        const saved = await res.json()
        setServices(prev => prev.map(s => s.id === saved.id ? saved : s))
        showToast('已保存 ✓')
      }
    } else {
      const res = await fetch('/api/services', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: varGroupName,
          description: group?.description ?? null,
          imageUrl: group?.imageUrl ?? null,
          durationMin: Number(varModal.durationMin),
          price: Number(varModal.price),
          isActive: true,
          sortOrder: group ? Math.max(...group.variants.map(v => v.sortOrder)) + 1 : 0,
        }),
      })
      if (res.ok) {
        const saved = await res.json()
        setServices(prev => [...prev, saved])
        showToast('已添加 ✓')
      }
    }
    setSaving(false); setVarModal(null)
  }

  // ── Toggle variant active ──────────────────────────────────
  async function toggleVariant(svc: Service) {
    const res = await fetch(`/api/services/${svc.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !svc.isActive }),
    })
    if (res.ok) setServices(prev => prev.map(s => s.id === svc.id ? { ...s, isActive: !s.isActive } : s))
  }

  // ── Delete variant ─────────────────────────────────────────
  async function deleteVariant(id: string) {
    const res = await fetch(`/api/services/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) { setServices(prev => prev.filter(s => s.id !== id)); showToast('已删除 ✓') }
    else if (data.error === 'HAS_APPOINTMENTS') showToast(`无法删除：有 ${data.count} 条关联预约`)
    else showToast('删除失败')
    setDeleting(null)
  }

  const inp: React.CSSProperties = { width:'100%', padding:'0.75rem 1rem', background:'#1c2333', border:'1px solid #2a3045', borderRadius:6, color:'#e2e8f0', fontSize:'0.9rem', outline:'none', boxSizing:'border-box' }
  const lbl: React.CSSProperties = { display:'block', fontSize:'0.72rem', fontWeight:500, color:'#7a8ba8', marginBottom:'0.5rem', letterSpacing:'0.05em', textTransform:'uppercase' }

  if (loading) return <div style={{ color:'#7a8ba8', fontSize:'0.85rem' }}>加载中…</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:600 }}>按摩项目</h1>
          <div style={{ fontSize:'0.82rem', color:'#7a8ba8', marginTop:'0.2rem' }}>每个项目可设置多个时长选项</div>
        </div>
        <button onClick={() => { setGroupOrigName(''); setGroupModal({ name: '', description: null, imageUrl: null }) }}
          style={{ padding:'0.5rem 1rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
          ＋ 添加项目
        </button>
      </div>

      {/* Service Groups */}
      <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
        {groups.map(group => (
          <div key={group.name} style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:10, overflow:'hidden' }}>
            {/* Group header */}
            <div style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'1rem 1.2rem', borderBottom:'1px solid #2a3045' }}>
              <div style={{ width:52, height:52, borderRadius:6, overflow:'hidden', background:'#161b27', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem' }}>
                {group.imageUrl ? <img src={group.imageUrl} alt={group.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '🌿'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, color:'#e2e8f0' }}>{group.name}</div>
                {group.description && <div style={{ fontSize:'0.78rem', color:'#7a8ba8', marginTop:'0.15rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{group.description}</div>}
              </div>
              <button onClick={() => { setGroupOrigName(group.name); setGroupModal({ name: group.name, description: group.description, imageUrl: group.imageUrl }) }}
                style={{ padding:'0.35rem 0.8rem', background:'transparent', border:'1px solid #2a3045', borderRadius:5, color:'#7a8ba8', fontSize:'0.75rem', cursor:'pointer', flexShrink:0 }}>
                编辑信息
              </button>
            </div>

            {/* Variants */}
            <div style={{ padding:'0.5rem 1.2rem 0.8rem' }}>
              <div style={{ fontSize:'0.68rem', color:'#4a5a6a', letterSpacing:'0.1em', textTransform:'uppercase', padding:'0.4rem 0', marginBottom:'0.2rem' }}>时长选项</div>
              {group.variants.map(v => (
                <div key={v.id} style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.55rem 0', borderBottom:'1px solid #1a2030' }}>
                  <span style={{ fontFamily:'monospace', fontSize:'0.8rem', background:'#161b27', border:'1px solid #2a3045', padding:'0.15rem 0.55rem', borderRadius:4, color:'#a0aec0', flexShrink:0 }}>{v.durationMin} min</span>
                  <span style={{ fontWeight:600, color:'#e8b86d', flexShrink:0, minWidth:40 }}>${Number(v.price).toFixed(0)}</span>
                  <span style={{ flex:1 }} />
                  <span style={{ fontSize:'0.65rem', padding:'0.1rem 0.45rem', borderRadius:3, background: v.isActive?'rgba(109,191,142,0.15)':'rgba(248,113,113,0.12)', color: v.isActive?'#6dbf8e':'#f87171' }}>
                    {v.isActive ? '上架' : '下架'}
                  </span>
                  <button onClick={() => toggleVariant(v)} style={{ padding:'0.2rem 0.55rem', background:'transparent', border:'1px solid #2a3045', borderRadius:4, color:'#7a8ba8', fontSize:'0.7rem', cursor:'pointer' }}>
                    {v.isActive ? '下架' : '上架'}
                  </button>
                  <button onClick={() => { setVarGroupName(group.name); setVarModal({ ...v }) }} style={{ padding:'0.2rem 0.55rem', background:'transparent', border:'1px solid #2a3045', borderRadius:4, color:'#7a8ba8', fontSize:'0.7rem', cursor:'pointer' }}>编辑</button>
                  <button onClick={() => setDeleting(v.id)} style={{ padding:'0.2rem 0.55rem', background:'transparent', border:'1px solid rgba(248,113,113,0.3)', borderRadius:4, color:'#f87171', fontSize:'0.7rem', cursor:'pointer' }}>删除</button>
                </div>
              ))}
              <button onClick={() => { setVarGroupName(group.name); setVarModal({ isActive: true }) }}
                style={{ marginTop:'0.6rem', padding:'0.4rem', background:'transparent', border:'1px dashed #2a3045', borderRadius:5, color:'#7a8ba8', fontSize:'0.75rem', cursor:'pointer', width:'100%' }}>
                ＋ 添加时长选项
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Group Modal ────────────────────────────────────── */}
      {groupModal && (
        <div onClick={() => setGroupModal(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#161b27', border:'1px solid #2a3045', borderRadius:12, width:'min(460px,94vw)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)', maxHeight:'90vh', overflow:'auto' }}>
            <div style={{ padding:'1.2rem 1.4rem', borderBottom:'1px solid #2a3045', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#161b27' }}>
              <span style={{ fontWeight:600 }}>{groupOrigName ? '编辑项目信息' : '添加新项目'}</span>
              <button onClick={() => setGroupModal(null)} style={{ width:28, height:28, borderRadius:'50%', background:'#1c2333', border:'1px solid #2a3045', color:'#7a8ba8', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:'1.4rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div>
                <label style={lbl}>项目图片</label>
                <div style={{ height:110, borderRadius:6, overflow:'hidden', border:'1px solid #2a3045', background:'#1c2333', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.5rem', marginBottom:'0.6rem' }}>
                  {groupModal.imageUrl ? <img src={groupModal.imageUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '🌿'}
                </div>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
                    onChange={async e => { const f = e.target.files?.[0]; if (f) { const url = await uploadImage(f); if (url) setGroupModal(m => m ? {...m, imageUrl: url} : m) } }} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    style={{ padding:'0.4rem 0.9rem', background:'transparent', border:'1px solid #2a3045', borderRadius:5, color:'#7a8ba8', fontSize:'0.78rem', cursor:'pointer', opacity:uploading?0.5:1 }}>
                    {uploading ? '上传中…' : '上传图片'}
                  </button>
                  {groupModal.imageUrl && (
                    <button onClick={() => setGroupModal(m => m ? {...m, imageUrl: null} : m)}
                      style={{ padding:'0.4rem 0.9rem', background:'transparent', border:'1px solid rgba(248,113,113,0.3)', borderRadius:5, color:'#f87171', fontSize:'0.78rem', cursor:'pointer' }}>
                      移除
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label style={lbl}>项目名称 *</label>
                <input value={groupModal.name} onChange={e => setGroupModal(m => m ? {...m, name: e.target.value} : m)} placeholder="e.g. Swedish Massage" style={inp} />
              </div>
              <div>
                <label style={lbl}>介绍文字</label>
                <textarea value={groupModal.description ?? ''} onChange={e => setGroupModal(m => m ? {...m, description: e.target.value} : m)}
                  rows={3} placeholder="服务描述…" style={{...inp, resize:'vertical'}} />
              </div>
            </div>
            <div style={{ padding:'1rem 1.4rem', borderTop:'1px solid #2a3045', display:'flex', gap:'0.6rem', justifyContent:'flex-end' }}>
              <button onClick={() => setGroupModal(null)} style={{ padding:'0.6rem 1.2rem', background:'transparent', border:'1px solid #2a3045', borderRadius:6, color:'#7a8ba8', fontSize:'0.83rem', cursor:'pointer' }}>取消</button>
              <button onClick={groupOrigName ? saveGroup : async () => {
                if (!groupModal.name) return
                setSaving(true)
                const res = await fetch('/api/services', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: groupModal.name, description: groupModal.description, imageUrl: groupModal.imageUrl, durationMin: 60, price: 0, isActive: true, sortOrder: services.length }),
                })
                if (res.ok) {
                  const saved = await res.json()
                  setServices(prev => [...prev, saved])
                  setGroupModal(null)
                  setVarGroupName(saved.name)
                  setVarModal({ id: saved.id, durationMin: 60, price: '0', isActive: true })
                  showToast('项目已创建，请设置时长和价格')
                }
                setSaving(false)
              }} disabled={saving}
                style={{ padding:'0.6rem 1.4rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.83rem', fontWeight:600, cursor:'pointer', opacity:saving?0.7:1 }}>
                {saving ? '保存中…' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Variant Modal ──────────────────────────────────── */}
      {varModal && (
        <div onClick={() => setVarModal(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#161b27', border:'1px solid #2a3045', borderRadius:12, width:'min(360px,94vw)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
            <div style={{ padding:'1.2rem 1.4rem', borderBottom:'1px solid #2a3045', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <span style={{ fontWeight:600 }}>{varModal.id ? '编辑时长选项' : '添加时长选项'}</span>
                <div style={{ fontSize:'0.75rem', color:'#7a8ba8', marginTop:'0.1rem' }}>{varGroupName}</div>
              </div>
              <button onClick={() => setVarModal(null)} style={{ width:28, height:28, borderRadius:'50%', background:'#1c2333', border:'1px solid #2a3045', color:'#7a8ba8', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:'1.4rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <div>
                  <label style={lbl}>时长（分钟）*</label>
                  <input value={varModal.durationMin ?? ''} onChange={e => setVarModal(m => m ? {...m, durationMin: Number(e.target.value)} : m)}
                    type="number" min="1" placeholder="60" style={inp} />
                </div>
                <div>
                  <label style={lbl}>价格（$）*</label>
                  <input value={varModal.price ?? ''} onChange={e => setVarModal(m => m ? {...m, price: e.target.value} : m)}
                    type="number" min="0" placeholder="75" style={inp} />
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{...lbl, margin:0}}>上架状态</span>
                <button onClick={() => setVarModal(m => m ? {...m, isActive: !m.isActive} : m)}
                  style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', background: varModal.isActive ? '#e8b86d' : '#2a3045', position:'relative', transition:'background 0.2s' }}>
                  <span style={{ position:'absolute', top:3, left: varModal.isActive ? 22 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.2s', display:'block' }}/>
                </button>
              </div>
            </div>
            <div style={{ padding:'1rem 1.4rem', borderTop:'1px solid #2a3045', display:'flex', gap:'0.6rem', justifyContent:'flex-end' }}>
              <button onClick={() => setVarModal(null)} style={{ padding:'0.6rem 1.2rem', background:'transparent', border:'1px solid #2a3045', borderRadius:6, color:'#7a8ba8', fontSize:'0.83rem', cursor:'pointer' }}>取消</button>
              <button onClick={saveVariant} disabled={saving}
                style={{ padding:'0.6rem 1.4rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.83rem', fontWeight:600, cursor:'pointer', opacity:saving?0.7:1 }}>
                {saving ? '保存中…' : '确认保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ─────────────────────────────────── */}
      {deleting && (
        <div onClick={() => setDeleting(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#161b27', border:'1px solid rgba(248,113,113,0.3)', borderRadius:12, width:'min(340px,90vw)', padding:'1.6rem' }}>
            <div style={{ fontSize:'1rem', fontWeight:600, marginBottom:'0.5rem' }}>确认删除</div>
            <div style={{ fontSize:'0.85rem', color:'#7a8ba8', marginBottom:'1.2rem' }}>删除此时长选项？如有关联预约则无法删除。</div>
            <div style={{ display:'flex', gap:'0.6rem', justifyContent:'flex-end' }}>
              <button onClick={() => setDeleting(null)} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid #2a3045', borderRadius:6, color:'#7a8ba8', fontSize:'0.82rem', cursor:'pointer' }}>取消</button>
              <button onClick={() => deleteVariant(deleting)} style={{ padding:'0.5rem 1rem', background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.4)', borderRadius:6, color:'#f87171', fontSize:'0.82rem', fontWeight:600, cursor:'pointer' }}>确认删除</button>
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
