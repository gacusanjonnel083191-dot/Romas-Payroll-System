import { useEffect, useState } from 'react'
import { latestApprovedOutletCounts, outletMovementSummary, projectedOutletBalance } from './crateReconciliation'

const field = { padding:'8px', border:'1px solid #ccc', borderRadius:6, boxSizing:'border-box', width:'100%' }
const cell = { padding:'9px 10px', borderBottom:'1px solid #eee', whiteSpace:'nowrap', textAlign:'left' }
const button = { padding:'7px 11px', border:'1px solid #bbb', borderRadius:6, background:'#fff', cursor:'pointer' }
const blank = () => ({ count_date:'', crate_qty:'', cover_qty:'', counted_by_name:'', confirmation_reference:'' })
const csvCell = value => {
  const text = String(value ?? '')
  const safe = /^[\s]*[=+\-@]/.test(text) ? "'" + text : text
  return '"' + safe.replaceAll('"', '""') + '"'
}

export default function CrateRollingControl({ supabase, resellers, movements, movementsReady, today, adminRole, recordedBy }) {
  const [counts, setCounts] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState('')
  const [form, setForm] = useState(blank)
  const [other, setOther] = useState({ location_type:'bakery', location_label:'', ...blank() })
  const owner = String(adminRole).toLowerCase() === 'owner'
  const maySubmit = ['owner','manager','supervisor','asst_supervisor'].includes(String(adminRole).toLowerCase())

  async function load() {
    setError('')
    const rows = []
    for (let start = 0; start < 10000; start += 500) {
      const { data, error:loadError } = await supabase.from('crate_physical_counts').select('*')
        .order('submitted_at', { ascending:false }).range(start, start + 499)
      if (loadError) { setError('Physical counts could not load. Please refresh or check the crate database setup.'); setLoaded(false); return }
      rows.push(...(data || []))
      if ((data || []).length < 500) break
    }
    setCounts(rows)
    setLoaded(true)
  }
  useEffect(() => { void load() }, [])

  function edit(id) {
    setEditing(String(id))
    setForm({ ...blank(), count_date:today })
    setError('')
  }

  async function submit(event, locationType, resellerId, values) {
    event.preventDefault()
    if (busy) return
    const crates = Number(values.crate_qty), covers = Number(values.cover_qty)
    if (!values.crate_qty || !values.cover_qty || ![crates,covers].every(n => Number.isSafeInteger(n) && n >= 0) ||
      !values.count_date || values.count_date > today || values.counted_by_name.trim().length < 2 ||
      values.confirmation_reference.trim().length < 3 ||
      (locationType === 'vehicle' && values.location_label.trim().length < 2)) {
      setError('Enter an end-of-day date, whole-number crates and covers, counter name, and message/slip reference.')
      return
    }
    setBusy(true); setError('')
    const { error:saveError } = await supabase.from('crate_physical_counts').insert({
      location_type:locationType, reseller_id:locationType === 'outlet' ? resellerId : null,
      location_label:locationType === 'bakery' ? 'Bakery' : locationType === 'vehicle' ? values.location_label.trim() : '',
      count_date:values.count_date, crate_qty:crates, cover_qty:covers,
      counted_by_name:values.counted_by_name.trim(), confirmation_reference:values.confirmation_reference.trim(),
      notes:`Entered by ${recordedBy}`
    })
    if (saveError) setError(saveError.message)
    else {
      setEditing('')
      setOther({ location_type:'bakery', location_label:'', ...blank() })
      await load()
    }
    setBusy(false)
  }

  async function review(row, approve) {
    if (busy || !owner) return
    const notes = approve ? '' : window.prompt('Reason for rejecting this count:')
    if (notes === null || (!approve && String(notes).trim().length < 3)) return
    if (approve && !window.confirm(`Approve ${row.crate_qty} crates and ${row.cover_qty} covers as of ${row.count_date}?`)) return
    setBusy(true); setError('')
    const { error:reviewError } = await supabase.rpc('crate_review_physical_count', { p_count_id:row.id, p_approve:approve, p_notes:notes || '' })
    if (reviewError) setError(reviewError.message)
    else await load()
    setBusy(false)
  }

  const latest = latestApprovedOutletCounts(counts)
  const pending = counts.filter(c => c.status === 'pending')
  const pendingByOutlet = new Map()
  pending.filter(c => c.location_type === 'outlet').forEach(c => {
    const key = String(c.reseller_id)
    if (!pendingByOutlet.has(key)) pendingByOutlet.set(key, [])
    pendingByOutlet.get(key).push(c)
  })
  const outlets = (resellers || []).filter(r => `${r.name} ${r.area || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const rows = outlets.map(r => {
    const count = latest.get(String(r.id))
    const crates = movementsReady ? projectedOutletBalance(count, movements, 'crate') : null
    const covers = movementsReady ? projectedOutletBalance(count, movements, 'cover') : null
    const movement = movementsReady ? outletMovementSummary(r.id, movements, count) : null
    return { outlet:r, count, crates, covers, movement, pending:pendingByOutlet.get(String(r.id)) || [] }
  })
  const verified = (resellers || []).filter(r => latest.has(String(r.id))).length
  const otherCounts = counts.filter(c => c.location_type !== 'outlet' && c.status === 'approved')
    .filter((c, index, all) => all.findIndex(x => x.location_type === c.location_type && x.location_label.toLowerCase() === c.location_label.toLowerCase()) === index)
  const otherPending = pending.filter(c => c.location_type !== 'outlet')

  function exportSummary() {
    const header = ['Outlet','Area','Latest delivered date','Latest delivered crates','Latest delivered covers','Latest returned date','Latest returned crates','Latest returned covers','Last approved count date','Counted crates','Counted covers','Later crate change','Later cover change','Expected crates','Expected covers','Status']
    const data = rows.map(({ outlet:r, count:c, crates, covers, movement:m, pending:waiting }) => [
      r.name, r.area || '', m?.delivered.date || '', m?.delivered.crates || '', m?.delivered.covers || '',
      m?.returned.date || '', m?.returned.crates || '', m?.returned.covers || '',
      c?.count_date || '', c?.crate_qty ?? '', c?.cover_qty ?? '', crates?.changes ?? '', covers?.changes ?? '', crates?.expected ?? '', covers?.expected ?? '',
      waiting.length ? 'Pending owner review' : c ? (movementsReady ? 'Verified count; handovers provisional' : 'Movement ledger unavailable') : 'Awaiting physical count'
    ])
    const content = [header, ...data].map(line => line.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type:'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = `crates-summary-${today}.csv`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const countFields = (values, update) => <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:8, margin:'10px 0' }}>
    <label>Count date (end of day)<input aria-label="Count date" type="date" max={today} required style={field} value={values.count_date} onChange={e=>update('count_date',e.target.value)} /></label>
    <label>Crates counted<input aria-label="Crates counted" type="number" min="0" step="1" required style={field} value={values.crate_qty} onChange={e=>update('crate_qty',e.target.value)} /></label>
    <label>Covers counted<input aria-label="Covers counted" type="number" min="0" step="1" required style={field} value={values.cover_qty} onChange={e=>update('cover_qty',e.target.value)} /></label>
    <label>Counted by<input aria-label="Counted by" required style={field} value={values.counted_by_name} onChange={e=>update('counted_by_name',e.target.value)} /></label>
    <label>Message / slip reference<input aria-label="Message or slip reference" required style={field} value={values.confirmation_reference} onChange={e=>update('confirmation_reference',e.target.value)} /></label>
  </div>

  return <section style={{ background:'#fff', border:'1px solid #e6e6e6', borderRadius:12, padding:14, marginBottom:14 }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
      <div><h2 style={{ color:'#ca1b1b', margin:'0 0 3px', fontSize:20 }}>Crates inventory summary</h2>
        <p style={{ color:'#666', fontSize:12, margin:0 }}>One row per outlet. Dispatches and returns come from saved crate movements, including invoice settlements.</p></div>
      <button type="button" onClick={exportSummary} disabled={!loaded || !movementsReady} style={button}>Download Excel CSV</button>
    </div>
    <p style={{ fontSize:13, margin:'12px 0' }}><strong>{verified}</strong> of <strong>{(resellers || []).length}</strong> outlets counted and approved · <strong>{pending.length}</strong> counts awaiting owner review</p>
    {error && <p role="alert" style={{ color:'#a21515', background:'#fff5f5', padding:9 }}>{error}</p>}
    {!movementsReady && <p role="status" style={{ color:'#8a5300', fontSize:12 }}>Movement records are unavailable. Expected balances are hidden until they load.</p>}
    <input aria-label="Search outlets" placeholder="Search outlet…" value={search} onChange={e=>setSearch(e.target.value)} style={{ ...field, maxWidth:280, marginBottom:10 }} />
    {!loaded ? <p role="status">Loading physical counts…</p> : <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1020, fontSize:12 }}>
        <thead><tr style={{ background:'#f6f6f8' }}>{['Outlet','Latest delivered','Latest returned','Approved count','Crates balance','Covers balance','Status',''].map((h,i)=><th key={i} style={cell}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(({ outlet:r, count:c, crates, covers, movement:m, pending:waiting }) => <tr key={r.id}>
          <td style={{ ...cell, fontWeight:700 }}>{r.name}{r.area && <div style={{ color:'#777', fontWeight:400 }}>{r.area}</div>}</td>
          <td style={cell}>{m?.delivered.date || '—'}{m?.delivered.date && <div>{m.delivered.crates} crates / {m.delivered.covers} covers</div>}</td>
          <td style={cell}>{m?.returned.date || '—'}{m?.returned.date && <div>{m.returned.crates} crates / {m.returned.covers} covers</div>}</td>
          <td style={cell}>{c?.count_date || '—'}{c && <div>{c.crate_qty} crates / {c.cover_qty} covers</div>}</td>
          <td style={{ ...cell, fontWeight:700 }}>{!movementsReady ? '—' : crates?.expected ?? m?.ledgerNet.crates ?? '—'}</td>
          <td style={{ ...cell, fontWeight:700 }}>{!movementsReady ? '—' : covers?.expected ?? m?.ledgerNet.covers ?? '—'}</td>
          <td style={{ ...cell, color:waiting.length || !c ? '#9a5b00' : '#276b42' }}>{waiting.length ? 'Pending review' : c ? 'Count approved; later handovers provisional' : 'Unverified ledger balance'}</td>
          <td style={cell}>{maySubmit && <button type="button" style={button} onClick={()=>edit(r.id)}>{c ? 'Update count' : 'Enter count'}</button>}</td>
        </tr>).flatMap(row => {
          const id = String(row.key)
          const waiting = pendingByOutlet.get(id) || []
          const details = editing === id || waiting.length > 0
          if (!details) return [row]
          return [row, <tr key={id + '-entry'}><td colSpan={8} style={{ padding:'10px 14px', background:'#fafafa', borderBottom:'1px solid #ddd', whiteSpace:'normal' }}>
            {waiting.map(c => <div key={c.id} style={{ marginBottom:7 }}>Count for {c.count_date}: <strong>{c.crate_qty} crates / {c.cover_qty} covers</strong> · {c.counted_by_name} · {c.confirmation_reference} {owner && <span><button type="button" disabled={busy} style={button} onClick={()=>review(c,true)}>Approve</button> <button type="button" disabled={busy} style={button} onClick={()=>review(c,false)}>Reject</button></span>}</div>)}
            {editing === id && <form onSubmit={e=>submit(e,'outlet',id,form)}>
              {countFields(form,(name,value)=>setForm(f=>({ ...f, [name]:value })))}
              <button type="submit" disabled={busy} style={{ ...button, background:'#ca1b1b', color:'#fff', border:0 }}>{busy ? 'Saving…' : 'Submit for owner review'}</button>{' '}
              <button type="button" style={button} onClick={()=>setEditing('')}>Cancel</button>
            </form>}
          </td></tr>]
        })}</tbody>
      </table>
      {rows.length === 0 && <p style={{ padding:12 }}>No outlets match this search.</p>}
    </div>}
    <p style={{ fontSize:11, color:'#777', margin:'12px 0 0' }}>Latest delivered/returned shows the last recorded date and total handovers on that date. Balance uses the approved end-of-day count plus later recorded movements; without a count it shows the unverified ledger net. Corrections also affect the balance. Do not enter an invoice settlement handover again in the manual forms below.</p>
    <details style={{ marginTop:12, borderTop:'1px solid #eee', paddingTop:10 }}>
      <summary style={{ cursor:'pointer', fontWeight:600, fontSize:12 }}>Bakery and vehicle counts</summary>
      {otherCounts.map(c=><p key={c.id} style={{ fontSize:12 }}>{c.location_label}: {c.crate_qty} crates / {c.cover_qty} covers · {c.count_date} (physical snapshot)</p>)}
      {otherPending.map(c=><p key={c.id} style={{ fontSize:12 }}>{c.location_label}: {c.crate_qty} crates / {c.cover_qty} covers · {c.count_date} (pending) {owner && <span><button type="button" disabled={busy} onClick={()=>review(c,true)}>Approve</button> <button type="button" disabled={busy} onClick={()=>review(c,false)}>Reject</button></span>}</p>)}
      {maySubmit && <form onSubmit={e=>submit(e,other.location_type,null,other)} style={{ fontSize:12 }}>
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <label>Location<select style={field} value={other.location_type} onChange={e=>setOther(f=>({ ...f, location_type:e.target.value }))}><option value="bakery">Bakery</option><option value="vehicle">Vehicle</option></select></label>
          {other.location_type === 'vehicle' && <label>Vehicle identifier<input required style={field} value={other.location_label} onChange={e=>setOther(f=>({ ...f, location_label:e.target.value }))} /></label>}
        </div>
        {countFields(other,(name,value)=>setOther(f=>({ ...f, [name]:value })))}
        <button type="submit" disabled={busy} style={button}>{busy ? 'Saving…' : 'Submit for owner review'}</button>
      </form>}
    </details>
  </section>
}
