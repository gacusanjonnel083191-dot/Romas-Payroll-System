import { useEffect, useState } from 'react'
import { latestApprovedOutletCounts, projectedOutletBalance } from './crateReconciliation'

const box = { background:'#fff', border:'1px solid #e9e9e9', borderRadius:12, padding:14, marginBottom:14 }
const field = { padding:'9px 10px', border:'1px solid #ccc', borderRadius:8, width:'100%', boxSizing:'border-box' }
const label = { display:'block', fontSize:12, fontWeight:700, marginBottom:4 }

export default function CrateRollingControl({ supabase, resellers, movements, movementsReady, today, adminRole, recordedBy }) {
  const [counts, setCounts] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ location_type:'outlet', reseller_id:'', location_label:'', count_date:today, crate_qty:'', cover_qty:'', counted_by_name:'', confirmation_reference:'', notes:'' })
  const owner = String(adminRole).toLowerCase() === 'owner'
  const maySubmit = ['owner','manager','supervisor','asst_supervisor'].includes(String(adminRole).toLowerCase())

  async function load() {
    setError('')
    const rows = []
    for (let start = 0; start < 10000; start += 500) {
      const { data, error:loadError } = await supabase.from('crate_physical_counts').select('*')
        .order('submitted_at', { ascending:false }).range(start, start + 499)
      if (loadError) { setError('Rolling count setup is unavailable. Apply the crate migration before using this tab.'); return }
      rows.push(...(data || []))
      if ((data || []).length < 500) break
    }
    setCounts(rows)
  }
  useEffect(() => { void load() }, []) // This panel mounts when the Crates tab opens.

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const crates = Number(form.crate_qty), covers = Number(form.cover_qty)
    if (![crates,covers].every(n => Number.isSafeInteger(n) && n >= 0) || !form.count_date || form.count_date > today ||
      (form.location_type === 'outlet' && !form.reseller_id) ||
      (form.location_type === 'vehicle' && form.location_label.trim().length < 2) ||
      form.counted_by_name.trim().length < 2 || form.confirmation_reference.trim().length < 3) {
      setError('Enter a valid location, end-of-day date, both whole-number counts, counter name, and confirmation reference.')
      return
    }
    setBusy(true); setError('')
    const { error:saveError } = await supabase.from('crate_physical_counts').insert({
      location_type:form.location_type, reseller_id:form.location_type === 'outlet' ? form.reseller_id : null,
      location_label:form.location_type === 'bakery' ? 'Bakery' : form.location_type === 'vehicle' ? form.location_label.trim() : '',
      count_date:form.count_date, crate_qty:crates, cover_qty:covers,
      counted_by_name:form.counted_by_name.trim(), confirmation_reference:form.confirmation_reference.trim(),
      notes:[form.notes.trim(), `Entered by ${recordedBy}`].filter(Boolean).join(' | ')
    })
    setBusy(false)
    if (saveError) { setError(saveError.message); return }
    setForm(f => ({ ...f, crate_qty:'', cover_qty:'', confirmation_reference:'', notes:'' }))
    await load()
  }

  async function review(row, approve) {
    if (busy || !owner) return
    const notes = approve ? '' : window.prompt('Reason for rejecting this count (the original stays in history):')
    if (notes === null || (!approve && String(notes).trim().length < 3)) return
    if (approve && !window.confirm(`Approve ${row.crate_qty} crates and ${row.cover_qty} covers at ${row.location_type === 'outlet' ? resellers.find(r => r.id === row.reseller_id)?.name || 'outlet' : row.location_label} as of end of ${row.count_date}?`)) return
    setBusy(true); setError('')
    const { error:reviewError } = await supabase.rpc('crate_review_physical_count', { p_count_id:row.id, p_approve:approve, p_notes:notes || '' })
    setBusy(false)
    if (reviewError) { setError(reviewError.message); return }
    await load()
  }

  const latest = latestApprovedOutletCounts(counts)
  const pending = counts.filter(c => c.status === 'pending')
  const unverified = (resellers || []).filter(r => !latest.has(String(r.id))).length
  const localCounts = counts.filter(c => c.status === 'approved' && c.location_type !== 'outlet')
    .filter((c, i, all) => all.findIndex(x => x.location_type === c.location_type && x.location_label.toLowerCase() === c.location_label.toLowerCase()) === i)
  const update = (name, value) => setForm(f => ({ ...f, [name]:value }))

  return <div>
    <div style={box}>
      <h2 style={{ margin:'0 0 6px', color:'#ca1b1b' }}>Rolling Physical Verification</h2>
      <p style={{ fontSize:12, color:'#555', margin:0 }}>Count each location after its final handover for that day. Late replies are entered with the actual count date. Owner approval starts a verified balance for that location only; older crate records remain available for investigation.</p>
    </div>
    {error && <div role="alert" style={{ ...box, borderColor:'#ca1b1b', color:'#a21515' }}>{error}</div>}
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:10, marginBottom:14 }}>
      {[['Outlets verified',latest.size],['Outlets awaiting first count',unverified],['Counts for owner review',pending.length],['Bakery / vehicle snapshots',localCounts.length]].map(([name,value]) => <div key={name} style={box}><div style={{ fontSize:12, color:'#666' }}>{name}</div><strong style={{ fontSize:22, color:'#1a1a2e' }}>{value}</strong></div>)}
    </div>
    {maySubmit && <form onSubmit={submit} style={box}>
      <h3 style={{ margin:'0 0 5px', color:'#1a1a2e' }}>Record a physical count</h3>
      <p style={{ fontSize:12, color:'#666' }}>Both crates and covers are required. Record the reseller's message, signed slip, or staff witness in the confirmation reference.</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))', gap:10 }}>
        <div><label style={label}>Location type</label><select style={field} value={form.location_type} onChange={e=>update('location_type',e.target.value)}><option value="outlet">Outlet</option><option value="bakery">Bakery</option><option value="vehicle">Vehicle</option></select></div>
        {form.location_type === 'outlet' ? <div><label style={label}>Outlet</label><select style={field} value={form.reseller_id} onChange={e=>update('reseller_id',e.target.value)} required><option value="">Select outlet</option>{(resellers || []).map(r=><option key={r.id} value={r.id}>{r.name}{r.area ? ` — ${r.area}` : ''}</option>)}</select></div> : form.location_type === 'vehicle' ? <div><label style={label}>Vehicle identifier</label><input style={field} value={form.location_label} onChange={e=>update('location_label',e.target.value)} placeholder="Plate or vehicle code" required /></div> : null}
        <div><label style={label}>Count as of end of day</label><input style={field} type="date" max={today} value={form.count_date} onChange={e=>update('count_date',e.target.value)} required /></div>
        <div><label style={label}>Crates physically counted</label><input style={field} type="number" min="0" step="1" value={form.crate_qty} onChange={e=>update('crate_qty',e.target.value)} required /></div>
        <div><label style={label}>Covers physically counted</label><input style={field} type="number" min="0" step="1" value={form.cover_qty} onChange={e=>update('cover_qty',e.target.value)} required /></div>
        <div><label style={label}>Person who counted</label><input style={field} value={form.counted_by_name} onChange={e=>update('counted_by_name',e.target.value)} required /></div>
        <div><label style={label}>Confirmation reference</label><input style={field} value={form.confirmation_reference} onChange={e=>update('confirmation_reference',e.target.value)} placeholder="Message date / signed slip / witness" required /></div>
        <div><label style={label}>Notes</label><input style={field} value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder="Optional explanation" /></div>
      </div>
      <button type="submit" disabled={busy} style={{ marginTop:12, padding:'10px 18px', background:'#ca1b1b', color:'#fff', border:0, borderRadius:8, cursor:'pointer' }}>{busy?'Saving…':'SUBMIT FOR OWNER REVIEW'}</button>
    </form>}
    {pending.length > 0 && <div style={box}><h3 style={{ margin:'0 0 10px' }}>Pending counts</h3>{pending.map(c=><div key={c.id} style={{ borderTop:'1px solid #eee', padding:'9px 0', fontSize:12 }}><strong>{c.location_type === 'outlet' ? resellers.find(r=>r.id===c.reseller_id)?.name || 'Outlet' : c.location_label}</strong> · {c.count_date} · {c.crate_qty} crates / {c.cover_qty} covers · Counted by {c.counted_by_name} · {c.confirmation_reference}{owner && <span style={{ marginLeft:10 }}><button type="button" disabled={busy} onClick={()=>review(c,true)}>Approve</button> <button type="button" disabled={busy} onClick={()=>review(c,false)}>Reject</button></span>}</div>)}</div>}
    <div style={box}><h3 style={{ margin:'0 0 5px' }}>Outlet verification</h3><p style={{ fontSize:12, color:'#666' }}>Expected now = approved end-of-day count + recorded dispatches − recorded collections on later dates. It is provisional when handovers have not been entered.</p>{!movementsReady && <p role="alert" style={{ color:'#a21515' }}>Movement ledger is loading or unavailable. Projected balances are hidden.</p>}<div style={{ overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse', minWidth:650, fontSize:12 }}><thead><tr>{['Outlet','Last approved count','Counted crates / covers','Later recorded change','Expected from records','Status'].map(h=><th key={h} style={{ textAlign:'left', padding:8, borderBottom:'2px solid #ddd' }}>{h}</th>)}</tr></thead><tbody>{(resellers || []).map(r=>{ const c=latest.get(String(r.id)); const crates=movementsReady ? projectedOutletBalance(c,movements,'crate') : null; const covers=movementsReady ? projectedOutletBalance(c,movements,'cover') : null; return <tr key={r.id}><td style={{ padding:8, borderBottom:'1px solid #eee' }}>{r.name}{r.area ? ` — ${r.area}` : ''}</td><td>{c?.count_date || '—'}</td><td>{c ? `${c.crate_qty} / ${c.cover_qty}` : '—'}</td><td>{crates ? `${crates.changes >= 0 ? '+' : ''}${crates.changes} / ${covers.changes >= 0 ? '+' : ''}${covers.changes}` : '—'}</td><td>{crates ? `${crates.expected} / ${covers.expected}` : '—'}</td><td style={{ color:c?'#276b42':'#b35a00' }}>{c?'Count verified; handovers provisional':'AWAITING COUNT'}</td></tr> })}</tbody></table></div></div>
    {localCounts.length > 0 && <div style={box}><h3 style={{ margin:'0 0 6px' }}>Bakery and vehicle snapshots</h3><p style={{ fontSize:12, color:'#666' }}>These are dated physical counts. Vehicle and bakery transfers are not yet fully recorded in the old ledger, so these are not live available-stock totals.</p>{localCounts.map(c=><p key={c.id} style={{ fontSize:12 }}>{c.location_label}: {c.crate_qty} crates / {c.cover_qty} covers · {c.count_date}</p>)}</div>}
  </div>
}
