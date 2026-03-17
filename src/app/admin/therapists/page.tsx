'use client'
// src/app/admin/therapists/page.tsx
import { useEffect, useRef, useState } from 'react'

interface Therapist {
  id: string; name: string; title: string | null
  bio: string | null; googleReviewUrl: string | null
  avatarUrl: string | null
  bufferMins: number; isActive: boolean; sortOrder: number
}

interface WorkHourDay {
  dayOfWeek: number
  isWorkday: boolean
  openTime: string
  closeTime: string
}

const EMOJIS = ['🧘‍♀️','🌸','💫','🌿','✨','💆']

const DAY_ZH = ['周日','周一','周二','周三','周四','周五','周六']
const DAY_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const DEFAULT_HOURS: WorkHourDay[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i, isWorkday: true, openTime: '09:00', closeTime: '21:00',
}))

export default function TherapistsPage() {
  const [list, setList]         = useState<Therapist[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<Partial<Therapist> | null>(null)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState('')
  const [lang, setLang]         = useState<'zh'|'en'>('zh')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Work hours modal state
  const [hoursModal, setHoursModal]   = useState<{ therapist: Therapist; hours: WorkHourDay[] } | null>(null)
  const [hoursSaving, setHoursSaving] = useState(false)
  const [hoursLoading, setHoursLoading] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    fetch('/api/therapists?all=1').then(r => r.json()).then(d => { setList(Array.isArray(d)?d:[]); setLoading(false) })
  }, [])

  async function openHoursModal(t: Therapist) {
    setHoursLoading(true)
    setHoursModal({ therapist: t, hours: DEFAULT_HOURS })
    const res = await fetch(`/api/therapists/${t.id}/hours`)
    if (res.ok) {
      const data = await res.json()
      setHoursModal({ therapist: t, hours: data })
    }
    setHoursLoading(false)
  }

  async function saveHours() {
    if (!hoursModal) return
    setHoursSaving(true)
    const res = await fetch(`/api/therapists/${hoursModal.therapist.id}/hours`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hoursModal.hours),
    })
    setHoursSaving(false)
    if (res.ok) {
      setHoursModal(null)
      showToast(lang==='zh' ? '上班时间已保存 ✓' : 'Work hours saved ✓')
    } else {
      showToast(lang==='zh' ? '保存失败' : 'Save failed')
    }
  }

  function updateHourDay(dow: number, patch: Partial<WorkHourDay>) {
    setHoursModal(m => m ? {
      ...m,
      hours: m.hours.map(d => d.dayOfWeek === dow ? { ...d, ...patch } : d),
    } : null)
  }

  async function uploadAvatar(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (res.ok) {
      setModal(m => ({ ...m, avatarUrl: data.url }))
    } else {
      showToast(lang==='zh' ? '图片上传失败' : 'Upload failed')
    }
  }

  async function save() {
    if (!modal?.name) { showToast(lang==='zh'?'请填写姓名':'Name is required'); return }
    setSaving(true)
    const isNew = !modal.id
    const res = await fetch(isNew ? '/api/therapists' : `/api/therapists/${modal.id}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modal),
    })
    const saved = await res.json()
    setSaving(false)
    if (res.ok) {
      if (isNew) setList(p => [...p, saved])
      else setList(p => p.map(t => t.id === saved.id ? saved : t))
      setModal(null)
      showToast(lang==='zh'?(isNew?'技师已添加 ✓':'已保存 ✓'):(isNew?'Added ✓':'Saved ✓'))
    } else showToast(lang==='zh'?'保存失败':'Save failed')
  }

  async function deleteTherapist(t: Therapist) {
    const res = await fetch(`/api/therapists/${t.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      setList(p => p.filter(x => x.id !== t.id))
      showToast(lang==='zh' ? '已删除 ✓' : 'Deleted ✓')
    } else if (data.error === 'HAS_APPOINTMENTS') {
      showToast(lang==='zh' ? `无法删除：有 ${data.count} 条关联预约` : `Cannot delete: ${data.count} linked appointments`)
    } else {
      showToast(lang==='zh' ? '删除失败' : 'Delete failed')
    }
    setDeleting(null)
  }

  async function toggleActive(t: Therapist) {
    const res = await fetch(`/api/therapists/${t.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ isActive: !t.isActive }),
    })
    if (res.ok) {
      setList(p => p.map(x => x.id===t.id ? {...x, isActive:!t.isActive} : x))
      showToast(!t.isActive ? (lang==='zh'?'已启用':'Enabled') : (lang==='zh'?'已停用':'Disabled'))
    }
  }

  const inp: React.CSSProperties = { width:'100%', padding:'0.75rem 1rem', background:'#1c2333', border:'1px solid #2a3045', borderRadius:6, color:'#e2e8f0', fontSize:'0.9rem', outline:'none', boxSizing:'border-box' }
  const lbl: React.CSSProperties = { display:'block', fontSize:'0.72rem', fontWeight:500, color:'#7a8ba8', marginBottom:'0.5rem', letterSpacing:'0.05em', textTransform:'uppercase' }

  if (loading) return <div style={{ color:'#7a8ba8' }}>{lang==='zh'?'加载中…':'Loading…'}</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:600 }}>{lang==='zh'?'技师管理':'Therapists'}</h1>
          <div style={{ fontSize:'0.82rem', color:'#7a8ba8', marginTop:'0.2rem' }}>{lang==='zh'?'管理技师档案与上班时间':'Manage therapist profiles & work hours'}</div>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          <div style={{ display:'flex', gap:'0.3rem' }}>
            {(['zh','en'] as const).map(l => (
              <button key={l} onClick={()=>setLang(l)} style={{ padding:'0.2rem 0.5rem', borderRadius:10, border:`1px solid ${lang===l?'#e8b86d':'#2a3045'}`, background:lang===l?'#e8b86d':'transparent', color:lang===l?'#0f1117':'#7a8ba8', fontSize:'0.6rem', fontFamily:'monospace', cursor:'pointer' }}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={() => setModal({ bufferMins: 15, isActive: true })}
            style={{ padding:'0.5rem 1rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
            ＋ {lang==='zh'?'添加技师':'Add Therapist'}
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'1rem' }}>
        {list.map((t, i) => (
          <div key={t.id} style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, overflow:'hidden', opacity: t.isActive ? 1 : 0.6, transition:'opacity 0.2s' }}>
            <div style={{ height:120, background:'linear-gradient(135deg,#161b27,#1c2333)', display:'flex', alignItems:'center', justifyContent:'center', borderBottom:'1px solid #2a3045', position:'relative', overflow:'hidden' }}>
              {t.avatarUrl
                ? <img src={t.avatarUrl} alt={t.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <span style={{ fontSize:'3rem' }}>{EMOJIS[i % EMOJIS.length]}</span>
              }
              <span style={{ position:'absolute', top:8, right:8, padding:'0.15rem 0.5rem', borderRadius:4, fontFamily:'monospace', fontSize:'0.6rem', background: t.isActive?'rgba(109,191,142,0.2)':'rgba(248,113,113,0.2)', color: t.isActive?'#6dbf8e':'#f87171' }}>
                {t.isActive ? (lang==='zh'?'在职':'Active') : (lang==='zh'?'停用':'Inactive')}
              </span>
            </div>
            <div style={{ padding:'1rem 1.1rem' }}>
              <div style={{ fontSize:'0.62rem', fontFamily:'monospace', color:'#7a8ba8', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'0.3rem' }}>{t.title ?? 'Therapist'}</div>
              <div style={{ fontSize:'0.95rem', fontWeight:500, marginBottom:'0.5rem' }}>{t.name}</div>
              <div style={{ fontSize:'0.78rem', color:'#7a8ba8', lineHeight:1.6, marginBottom:'0.8rem', overflow:'hidden', display:'-webkit-box' as any, WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any }}>
                {t.bio ?? (lang==='zh'?'暂无简介':'No bio yet')}
              </div>
              <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.8rem', alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontFamily:'monospace', fontSize:'0.62rem', background:'#161b27', border:'1px solid #2a3045', padding:'0.1rem 0.45rem', borderRadius:4, color:'#7a8ba8' }}>
                  {lang==='zh'?'缓冲':'buffer'} {t.bufferMins}min
                </span>
                {t.googleReviewUrl && (
                  <a href={t.googleReviewUrl} target="_blank" rel="noreferrer"
                    style={{ fontFamily:'monospace', fontSize:'0.62rem', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.25)', padding:'0.1rem 0.45rem', borderRadius:4, color:'#60a5fa', textDecoration:'none' }}>
                    Google ↗
                  </a>
                )}
              </div>
              <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                <button onClick={() => setModal(t)} style={{ flex:1, padding:'0.4rem', background:'transparent', border:'1px solid #2a3045', borderRadius:5, color:'#7a8ba8', fontSize:'0.75rem', cursor:'pointer' }}>
                  {lang==='zh'?'编辑档案':'Edit'}
                </button>
                <button onClick={() => openHoursModal(t)} style={{ flex:1, padding:'0.4rem', background:'transparent', border:'1px solid rgba(232,184,109,0.35)', borderRadius:5, color:'#e8b86d', fontSize:'0.75rem', cursor:'pointer' }}>
                  {lang==='zh'?'上班时间':'Hours'}
                </button>
                <button onClick={() => toggleActive(t)} style={{ flex:1, padding:'0.4rem', background:'transparent', border:`1px solid ${t.isActive?'rgba(248,113,113,0.3)':'rgba(109,191,142,0.3)'}`, borderRadius:5, color: t.isActive?'#f87171':'#6dbf8e', fontSize:'0.75rem', cursor:'pointer' }}>
                  {t.isActive ? (lang==='zh'?'停用':'Disable') : (lang==='zh'?'启用':'Enable')}
                </button>
                <button onClick={() => setDeleting(t.id)} style={{ padding:'0.4rem 0.6rem', background:'transparent', border:'1px solid rgba(248,113,113,0.3)', borderRadius:5, color:'#f87171', fontSize:'0.75rem', cursor:'pointer' }}>🗑</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Edit Profile Modal ── */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#161b27', border:'1px solid #2a3045', borderRadius:12, width:'min(480px,94vw)', maxHeight:'90vh', overflow:'auto', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
            <div style={{ padding:'1.2rem 1.4rem', borderBottom:'1px solid #2a3045', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#161b27' }}>
              <span style={{ fontWeight:600 }}>{modal.id ? (lang==='zh'?'编辑技师':'Edit Therapist') : (lang==='zh'?'添加技师':'New Therapist')}</span>
              <button onClick={() => setModal(null)} style={{ width:28, height:28, borderRadius:'50%', background:'#1c2333', border:'1px solid #2a3045', color:'#7a8ba8', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:'1.4rem', display:'flex', flexDirection:'column', gap:'1rem' }}>

              {/* Avatar upload */}
              <div>
                <label style={lbl}>{lang==='zh'?'技师照片':'Photo'}</label>
                <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
                  <div style={{ width:72, height:72, borderRadius:'50%', background:'#1c2333', border:'1px solid #2a3045', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2rem' }}>
                    {modal.avatarUrl
                      ? <img src={modal.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : '🧘‍♀️'
                    }
                  </div>
                  <div style={{ flex:1 }}>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                      style={{ padding:'0.4rem 0.9rem', background:'transparent', border:'1px solid #2a3045', borderRadius:5, color:'#7a8ba8', fontSize:'0.78rem', cursor:'pointer', opacity:uploading?0.5:1 }}>
                      {uploading ? (lang==='zh'?'上传中…':'Uploading…') : (lang==='zh'?'上传照片':'Upload photo')}
                    </button>
                    {modal.avatarUrl && (
                      <button onClick={() => setModal(m => ({...m, avatarUrl: null}))}
                        style={{ marginLeft:'0.5rem', padding:'0.4rem 0.9rem', background:'transparent', border:'1px solid rgba(248,113,113,0.3)', borderRadius:5, color:'#f87171', fontSize:'0.78rem', cursor:'pointer' }}>
                        {lang==='zh'?'移除':'Remove'}
                      </button>
                    )}
                    <div style={{ fontSize:'0.7rem', color:'#7a8ba8', marginTop:'0.4rem' }}>JPG / PNG / WebP，最大 5MB</div>
                  </div>
                </div>
              </div>

              {([
                {label:lang==='zh'?'姓名':'Name', key:'name', ph:'Full name', required:true},
                {label:lang==='zh'?'职位介绍':'Title', key:'title', ph:'e.g. Lead Therapist · 8 yrs'},
                {label:lang==='zh'?'Google 评论链接':'Google Review URL', key:'googleReviewUrl', ph:'https://...'},
              ] as const).map(f => (
                <div key={f.key}>
                  <label style={lbl}>{f.label}{(f as any).required?' *':''}</label>
                  <input value={(modal as any)[f.key] ?? ''} onChange={e => setModal(m => ({...m,[f.key]:e.target.value}))} placeholder={f.ph} style={inp} />
                </div>
              ))}
              <div>
                <label style={lbl}>{lang==='zh'?'个人简介':'Bio'}</label>
                <textarea value={modal.bio ?? ''} onChange={e => setModal(m => ({...m, bio:e.target.value}))} rows={3} placeholder={lang==='zh'?'技师简介…':'Therapist bio…'} style={{...inp, resize:'vertical'}} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.8rem' }}>
                <div>
                  <label style={lbl}>{lang==='zh'?'缓冲时间（分钟）':'Buffer Time (min)'}</label>
                  <input type="number" value={modal.bufferMins ?? 15} onChange={e => setModal(m => ({...m, bufferMins:Number(e.target.value)}))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>{lang==='zh'?'排序':'Sort Order'}</label>
                  <input type="number" value={modal.sortOrder ?? 0} onChange={e => setModal(m => ({...m, sortOrder:Number(e.target.value)}))} style={inp} />
                </div>
              </div>
              {modal.id && (
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', background:'rgba(248,113,113,0.05)', border:'1px solid rgba(248,113,113,0.15)', borderRadius:6 }}>
                  <span style={{ fontSize:'0.82rem', color:'#7a8ba8', flex:1 }}>
                    {lang==='zh'?'状态：':'Status: '}{modal.isActive ? (lang==='zh'?'在职':'Active') : (lang==='zh'?'已停用':'Inactive')}
                  </span>
                  <button onClick={() => setModal(m => ({...m, isActive:!m?.isActive}))}
                    style={{ padding:'0.3rem 0.8rem', borderRadius:5, border:`1px solid ${modal.isActive?'rgba(248,113,113,0.3)':'rgba(109,191,142,0.3)'}`, background:'transparent', color:modal.isActive?'#f87171':'#6dbf8e', fontSize:'0.78rem', cursor:'pointer' }}>
                    {modal.isActive ? (lang==='zh'?'停用':'Disable') : (lang==='zh'?'启用':'Enable')}
                  </button>
                </div>
              )}
            </div>
            <div style={{ padding:'1rem 1.4rem', borderTop:'1px solid #2a3045', display:'flex', gap:'0.6rem', justifyContent:'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding:'0.6rem 1.2rem', background:'transparent', border:'1px solid #2a3045', borderRadius:6, color:'#7a8ba8', fontSize:'0.83rem', cursor:'pointer' }}>{lang==='zh'?'取消':'Cancel'}</button>
              <button onClick={save} disabled={saving} style={{ padding:'0.6rem 1.4rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.83rem', fontWeight:600, cursor:'pointer', opacity:saving?0.7:1 }}>
                {saving ? (lang==='zh'?'保存中…':'Saving…') : (lang==='zh'?'确认保存':'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Work Hours Modal ── */}
      {hoursModal && (
        <div onClick={() => setHoursModal(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#161b27', border:'1px solid #2a3045', borderRadius:12, width:'min(480px,94vw)', maxHeight:'90vh', overflow:'auto', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
            <div style={{ padding:'1.2rem 1.4rem', borderBottom:'1px solid #2a3045', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#161b27' }}>
              <div>
                <span style={{ fontWeight:600 }}>{lang==='zh'?'上班时间':'Work Hours'}</span>
                <span style={{ fontSize:'0.78rem', color:'#7a8ba8', marginLeft:'0.6rem' }}>{hoursModal.therapist.name}</span>
              </div>
              <button onClick={() => setHoursModal(null)} style={{ width:28, height:28, borderRadius:'50%', background:'#1c2333', border:'1px solid #2a3045', color:'#7a8ba8', cursor:'pointer' }}>✕</button>
            </div>

            <div style={{ padding:'1.4rem', display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              {hoursLoading ? (
                <div style={{ textAlign:'center', color:'#7a8ba8', padding:'2rem' }}>{lang==='zh'?'加载中…':'Loading…'}</div>
              ) : (
                <>
                  {/* Header row */}
                  <div style={{ display:'grid', gridTemplateColumns:'3rem 1fr 6rem 6rem', gap:'0.5rem', alignItems:'center', padding:'0 0.2rem', marginBottom:'0.2rem' }}>
                    <div />
                    <div style={{ fontSize:'0.68rem', color:'#7a8ba8', textTransform:'uppercase', letterSpacing:'0.05em' }}>{lang==='zh'?'星期':'Day'}</div>
                    <div style={{ fontSize:'0.68rem', color:'#7a8ba8', textTransform:'uppercase', letterSpacing:'0.05em', textAlign:'center' }}>{lang==='zh'?'上班':'Open'}</div>
                    <div style={{ fontSize:'0.68rem', color:'#7a8ba8', textTransform:'uppercase', letterSpacing:'0.05em', textAlign:'center' }}>{lang==='zh'?'下班':'Close'}</div>
                  </div>

                  {hoursModal.hours.map(day => (
                    <div key={day.dayOfWeek} style={{ display:'grid', gridTemplateColumns:'3rem 1fr 6rem 6rem', gap:'0.5rem', alignItems:'center', padding:'0.5rem 0.4rem', borderRadius:6, background: day.isWorkday ? '#1c2333' : 'rgba(248,113,113,0.04)', border:`1px solid ${day.isWorkday ? '#2a3045' : 'rgba(248,113,113,0.15)'}` }}>
                      {/* Toggle */}
                      <div style={{ display:'flex', justifyContent:'center' }}>
                        <button
                          onClick={() => updateHourDay(day.dayOfWeek, { isWorkday: !day.isWorkday })}
                          style={{ width:36, height:20, borderRadius:10, border:'none', cursor:'pointer', background: day.isWorkday ? '#6dbf8e' : '#374151', position:'relative', transition:'background 0.2s', flexShrink:0 }}
                        >
                          <span style={{ position:'absolute', top:2, left: day.isWorkday ? 18 : 2, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
                        </button>
                      </div>

                      {/* Day name */}
                      <div style={{ fontSize:'0.85rem', color: day.isWorkday ? '#e2e8f0' : '#7a8ba8', fontWeight: day.isWorkday ? 500 : 400 }}>
                        {lang==='zh' ? DAY_ZH[day.dayOfWeek] : DAY_EN[day.dayOfWeek]}
                        {!day.isWorkday && <span style={{ fontSize:'0.7rem', marginLeft:'0.4rem', color:'#f87171' }}>{lang==='zh'?'休息':'Off'}</span>}
                      </div>

                      {/* Open time */}
                      <input
                        type="time"
                        value={day.openTime}
                        disabled={!day.isWorkday}
                        onChange={e => updateHourDay(day.dayOfWeek, { openTime: e.target.value })}
                        style={{ padding:'0.3rem 0.4rem', background:'#0f1117', border:'1px solid #2a3045', borderRadius:4, color: day.isWorkday ? '#e2e8f0' : '#374151', fontSize:'0.82rem', outline:'none', width:'100%', cursor: day.isWorkday ? 'text' : 'not-allowed' }}
                      />

                      {/* Close time */}
                      <input
                        type="time"
                        value={day.closeTime}
                        disabled={!day.isWorkday}
                        onChange={e => updateHourDay(day.dayOfWeek, { closeTime: e.target.value })}
                        style={{ padding:'0.3rem 0.4rem', background:'#0f1117', border:'1px solid #2a3045', borderRadius:4, color: day.isWorkday ? '#e2e8f0' : '#374151', fontSize:'0.82rem', outline:'none', width:'100%', cursor: day.isWorkday ? 'text' : 'not-allowed' }}
                      />
                    </div>
                  ))}

                  <div style={{ fontSize:'0.72rem', color:'#7a8ba8', marginTop:'0.4rem' }}>
                    {lang==='zh'
                      ? '时间为店铺本地时间（America/New_York）。未开班的时段顾客无法预约。'
                      : 'Times are in store local time (America/New_York). Slots outside work hours will be unavailable to customers.'
                    }
                  </div>
                </>
              )}
            </div>

            <div style={{ padding:'1rem 1.4rem', borderTop:'1px solid #2a3045', display:'flex', gap:'0.6rem', justifyContent:'flex-end' }}>
              <button onClick={() => setHoursModal(null)} style={{ padding:'0.6rem 1.2rem', background:'transparent', border:'1px solid #2a3045', borderRadius:6, color:'#7a8ba8', fontSize:'0.83rem', cursor:'pointer' }}>{lang==='zh'?'取消':'Cancel'}</button>
              <button onClick={saveHours} disabled={hoursSaving || hoursLoading} style={{ padding:'0.6rem 1.4rem', background:'linear-gradient(135deg,#e8b86d,#c49540)', border:'none', borderRadius:6, color:'#0f1117', fontSize:'0.83rem', fontWeight:600, cursor:'pointer', opacity:(hoursSaving||hoursLoading)?0.7:1 }}>
                {hoursSaving ? (lang==='zh'?'保存中…':'Saving…') : (lang==='zh'?'确认保存':'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleting && (() => {
        const t = list.find(x => x.id === deleting)!
        return (
          <div onClick={() => setDeleting(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background:'#161b27', border:'1px solid rgba(248,113,113,0.3)', borderRadius:12, width:'min(380px,90vw)', padding:'1.6rem', boxShadow:'0 4px 24px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize:'1rem', fontWeight:600, marginBottom:'0.5rem' }}>{lang==='zh'?'确认删除':'Confirm Delete'}</div>
              <div style={{ fontSize:'0.85rem', color:'#7a8ba8', marginBottom:'1.2rem' }}>
                {lang==='zh' ? `确定要删除技师「${t.name}」吗？此操作不可撤销。` : `Delete therapist "${t.name}"? This cannot be undone.`}
              </div>
              <div style={{ display:'flex', gap:'0.6rem', justifyContent:'flex-end' }}>
                <button onClick={() => setDeleting(null)} style={{ padding:'0.5rem 1rem', background:'transparent', border:'1px solid #2a3045', borderRadius:6, color:'#7a8ba8', fontSize:'0.82rem', cursor:'pointer' }}>{lang==='zh'?'取消':'Cancel'}</button>
                <button onClick={() => deleteTherapist(t)} style={{ padding:'0.5rem 1rem', background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.4)', borderRadius:6, color:'#f87171', fontSize:'0.82rem', fontWeight:600, cursor:'pointer' }}>{lang==='zh'?'确认删除':'Delete'}</button>
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
