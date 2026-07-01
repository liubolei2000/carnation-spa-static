'use client'
// src/app/admin/settings/page.tsx
import { useEffect, useState } from 'react'

const FIELDS = [
  { section:'基础信息', items:[
    { key:'site_name',    label:'店铺名称',   ph:'Carnation Spa' },
    { key:'site_tagline', label:'店铺标语',   ph:'A sanctuary...' },
    { key:'site_phone',   label:'联系电话',   ph:'(978) 330-0895' },
    { key:'site_address', label:'地址',       ph:'120 Cambridge St...' },
    { key:'site_hours',   label:'营业时间',   ph:'Monday–Sunday 9AM–9PM' },
    { key:'google_maps_url', label:'Google Maps 链接', ph:'https://maps.google.com/...' },
  ]},
  { section:'Hero 区块', items:[
    { key:'hero_title',    label:'主标题',  ph:'Find Your Stillness' },
    { key:'hero_subtitle', label:'副标题',  ph:'A sanctuary of calm...' },
    { key:'hero_eyebrow',  label:'眉标语',  ph:'carnation spa · burlington, ma' },
  ]},
  { section:'关于我们', items:[
    { key:'about_title', label:'标题', ph:'A Place to Restore...' },
    { key:'about_body',  label:'正文', ph:'Founded in 2018...', multiline: true },
    { key:'about_stats_years',   label:'年数统计',   ph:'6+' },
    { key:'about_stats_clients', label:'客户统计',   ph:'2k+' },
    { key:'about_stats_rating',  label:'评分统计',   ph:'4.9★' },
  ]},
  { section:'社交媒体', items:[
    { key:'social_instagram', label:'Instagram', ph:'https://www.instagram.com/...' },
    { key:'social_yelp',      label:'Yelp',      ph:'https://www.yelp.com/...' },
    { key:'social_google',    label:'Google',    ph:'https://share.google/...' },
  ]},
]

const TOGGLES = [
  { key:'show_gallery', label:'店铺照片相册', desc:'首页 Hero 下方的店铺实景照片区块' },
]

export default function SettingsPage() {
  const [config, setConfig]   = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState('')
  const [dirty, setDirty]     = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    fetch('/api/site-config').then(r => r.json()).then(d => { setConfig(d); setLoading(false) })
  }, [])

  function update(key: string, value: string) {
    setConfig(p => ({ ...p, [key]: value }))
    setDirty(true)
  }

  async function saveAll() {
    setSaving(true)
    const res = await fetch('/api/site-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
    if (res.ok) { showToast('已保存 ✓'); setDirty(false) }
    else showToast('保存失败')
  }

  const inp: React.CSSProperties = { width:'100%', padding:'0.75rem 1rem', background:'#0f1117', border:'1px solid #2a3045', borderRadius:6, color:'#e2e8f0', fontSize:'0.88rem', outline:'none', boxSizing:'border-box' }
  const lbl: React.CSSProperties = { display:'block', fontSize:'0.72rem', fontWeight:500, color:'#7a8ba8', marginBottom:'0.5rem', letterSpacing:'0.05em', textTransform:'uppercase' }

  if (loading) return <div style={{ color:'#7a8ba8' }}>加载中…</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:600 }}>网站设置</h1>
          <div style={{ fontSize:'0.82rem', color:'#7a8ba8', marginTop:'0.2rem' }}>编辑顾客端网页显示内容</div>
        </div>
        <button onClick={saveAll} disabled={saving || !dirty}
          style={{ padding:'0.5rem 1.2rem', background: dirty?'linear-gradient(135deg,#e8749a,#d44878)':'#2a3045', border:'none', borderRadius:6, color: dirty?'#0f1117':'#7a8ba8', fontSize:'0.85rem', fontWeight:600, cursor: dirty?'pointer':'default', transition:'all 0.2s' }}>
          {saving ? '保存中…' : dirty ? '💾 保存所有更改' : '已是最新'}
        </button>
      </div>

      {/* 页面区块开关 */}
      <div style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, padding:'1.4rem', marginBottom:'1rem' }}>
        <div style={{ fontSize:'0.82rem', fontWeight:600, color:'#e8749a', marginBottom:'1.2rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <div style={{ width:3, height:14, background:'#e8749a', borderRadius:2 }}/>
          页面区块显示
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.8rem' }}>
          {TOGGLES.map(t => {
            const on = config[t.key] !== '0'
            return (
              <div key={t.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                <div>
                  <div style={{ fontSize:'0.88rem', color:'#e2e8f0' }}>{t.label}</div>
                  <div style={{ fontSize:'0.72rem', color:'#7a8ba8', marginTop:'0.15rem' }}>{t.desc}</div>
                </div>
                <button onClick={() => update(t.key, on ? '0' : '1')}
                  style={{ flexShrink:0, width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', background: on ? '#e8749a' : '#2a3045', position:'relative', transition:'background 0.2s' }}>
                  <span style={{ position:'absolute', top:3, left: on ? 22 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.2s', display:'block' }}/>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:'1rem' }}>
        {FIELDS.map(section => (
          <div key={section.section} style={{ background:'#1c2333', border:'1px solid #2a3045', borderRadius:8, padding:'1.4rem' }}>
            <div style={{ fontSize:'0.82rem', fontWeight:600, color:'#e8749a', marginBottom:'1.2rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <div style={{ width:3, height:14, background:'#e8749a', borderRadius:2 }}/>
              {section.section}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              {section.items.map(f => (
                <div key={f.key}>
                  <label style={lbl}>{f.label}</label>
                  {(f as any).multiline ? (
                    <textarea value={config[f.key] ?? ''} onChange={e => update(f.key, e.target.value)}
                      rows={4} placeholder={f.ph} style={{...inp, resize:'vertical'}} />
                  ) : (
                    <input value={config[f.key] ?? ''} onChange={e => update(f.key, e.target.value)}
                      placeholder={f.ph} style={inp} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ position:'fixed', bottom:'1.5rem', right:'1.5rem', background:'#1c2333', border:'1px solid #2a3045', borderLeft:'3px solid #6dbf8e', borderRadius:6, padding:'0.75rem 1.2rem', fontSize:'0.82rem', transition:'all 0.3s', opacity:toast?1:0, transform:toast?'translateY(0)':'translateY(60px)', pointerEvents:'none', zIndex:600 }}>
        {toast}
      </div>
    </div>
  )
}
