import { useRef, useState } from 'react'
import { canReconcile, cashVariances, validCashAmount } from './cashHandover.js'

const peso = amount => '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits:2, maximumFractionDigits:2 })
const time = value => new Date(value).toLocaleString('en-PH', { timeZone:'Asia/Manila', dateStyle:'medium', timeStyle:'short' })
const input = { width:'100%', boxSizing:'border-box', minHeight:44, padding:9, border:'1px solid #bbb', borderRadius:7 }
const button = { minHeight:44, padding:'10px 14px', border:0, borderRadius:7, background:'#1a1a2e', color:'#fff', cursor:'pointer' }
const manilaNow = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0,16)

export default function CashHandover({ date, report, rows, supabase, onSaved, disabled }) {
  const latest = rows[0] || null
  const [editing, setEditing] = useState(false)
  const [handed, setHanded] = useState('')
  const [counted, setCounted] = useState('')
  const [by, setBy] = useState('Myra')
  const [at, setAt] = useState(()=>date + manilaNow().slice(10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const lock = useRef(false)
  const request = useRef(null)
  const recording = !latest || editing
  const expected = recording ? report.netRecordedCash : Number(latest.system_expected_cash)
  const declaration = recording ? handed : latest.cash_handed_over
  const preview = validCashAmount(declaration) ? cashVariances(expected, declaration, validCashAmount(counted) ? counted : null) : null

  async function save() {
    if (lock.current || disabled || !validCashAmount(declaration) || (!recording && !validCashAmount(counted)) || (counted !== '' && !validCashAmount(counted))) return
    if (recording && (!canReconcile(report) || !by.trim() || !at || (editing && !notes.trim()))) return
    lock.current = true; setSaving(true); setError(''); setMessage('')
    const payload = {
      p_day:date, p_previous_id:latest?.id || null, p_action:recording ? 'handover' : 'count',
      p_expected:expected, p_handed:Number(declaration), p_count:counted === '' ? null : Number(counted),
      p_handed_by:recording ? by.trim() : latest.handed_over_by,
      p_handover_at:recording ? new Date(at + ':00+08:00').toISOString() : latest.handover_at,
      p_notes:notes.trim() || null
    }
    // Retain the same token after a network failure; retries cannot append twice.
    const signature = JSON.stringify(payload)
    if (request.current?.signature !== signature) request.current = { signature, id:crypto.randomUUID() }
    try {
      const result = await supabase.rpc('owner_save_cash_handover', { ...payload, p_request_id:request.current.id })
      if (result.error) throw result.error
      setMessage('Saved. The audit history preserves the previous record.')
      setEditing(false); setHanded(''); setCounted(''); setNotes(''); request.current = null
      await onSaved()
    } catch (saveError) { setError(saveError.message || String(saveError)) }
    finally { lock.current = false; setSaving(false) }
  }

  const field = (label, value, change, type='text') => <label style={{ fontSize:12, minWidth:0 }}>{label}<input aria-label={label} type={type} value={value} onChange={event=>change(event.target.value)} style={input} step={type === 'number' ? '0.01' : undefined} min={type === 'number' ? 0 : undefined} /></label>
  return <section aria-label="Cash Handover & Reconciliation" style={{ background:'#fff', border:'1px solid #e7e7e7', borderRadius:12, padding:14, marginBottom:12 }}>
    <h3 style={{ margin:'0 0 8px', color:'#1a1a2e' }}>Cash Handover &amp; Reconciliation</h3>
    <p style={{ fontSize:12, color:'#555' }}>One company handover for {date}, recorded by the signed-in owner. Expected cash is this day’s net recorded cash movement; exclude opening floats and prior-day cash. Corrections add a new revision.</p>
    <p style={{ fontSize:13 }}>System Expected Cash: <strong>{peso(expected)}</strong>{latest && !recording && ' (saved at handover)'}</p>
    {latest && Number(latest.system_expected_cash) !== report.netRecordedCash && <p role="status" style={{ color:'#9a5b00', fontSize:12 }}>Recorded activity has changed since handover. Current expected cash is {peso(report.netRecordedCash)}. The saved reconciliation keeps its original expected amount; review the activity before recording a correction.</p>}
    {latest && <div style={{ background:'#f8f9fb', padding:10, borderRadius:7, fontSize:12 }}>
      <strong>{cashVariances(latest.system_expected_cash, latest.cash_handed_over, latest.owner_physical_count).status}</strong>
      <p>Handed over: {peso(latest.cash_handed_over)} · Owner count: {latest.owner_physical_count == null ? 'Not counted' : peso(latest.owner_physical_count)}</p>
      <p>Collection Variance: {peso(latest.collection_variance)} · Counting Variance: {latest.counting_variance == null ? 'Pending' : peso(latest.counting_variance)} · Final Variance: {latest.final_variance == null ? 'Pending' : peso(latest.final_variance)}</p>
      <p>{time(latest.handover_at)} · By {latest.handed_over_by} · Received by {latest.received_by}</p>
      {latest.owner_physical_count != null && !editing && <button type="button" style={button} disabled={disabled || saving} onClick={()=>{setEditing(true);setHanded(String(latest.cash_handed_over));setCounted(String(latest.owner_physical_count));setBy(latest.handed_over_by);setAt(new Date(new Date(latest.handover_at).getTime()+8*3600000).toISOString().slice(0,16));setNotes('')}}>Record correction</button>}
      {latest.owner_physical_count == null && !editing && <button type="button" style={button} disabled={disabled || saving} onClick={()=>{setEditing(true);setHanded(String(latest.cash_handed_over));setBy(latest.handed_over_by);setAt(new Date(new Date(latest.handover_at).getTime()+8*3600000).toISOString().slice(0,16));setNotes('')}}>Correct handover</button>}
    </div>}
    {(recording || latest?.owner_physical_count == null) && <>
      {recording && !canReconcile(report) && <p role="alert" style={{ color:'#9a5b00' }}>Review unclassified expenses and unknown or ambiguous payment entries before recording the handover.</p>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap:10, marginTop:12 }}>
        {recording && <>{field('Cash Handed Over', handed, setHanded, 'number')}{field('Handed over by', by, setBy)}{field('Handover time (Asia/Manila)', at, setAt, 'datetime-local')}</>}
        {field(recording ? 'Owner Physical Count (optional until counted)' : 'Owner Physical Count', counted, setCounted, 'number')}
      </div>
      <label style={{ display:'block', fontSize:12, marginTop:10 }}>{editing ? 'Correction reason (required)' : 'Notes'}<textarea aria-label={editing ? 'Correction reason' : 'Handover notes'} value={notes} maxLength={1000} onChange={event=>setNotes(event.target.value)} style={{ ...input, minHeight:70 }} /></label>
      {preview && <p style={{ fontSize:12 }}>Collection Variance: {peso(preview.collection)} · Counting Variance: {preview.counting == null ? 'Pending' : peso(preview.counting)} · Final Variance: {preview.final == null ? 'Pending' : peso(preview.final)} · <strong>{preview.status}</strong></p>}
      <button type="button" onClick={save} style={button} disabled={saving || disabled || !validCashAmount(declaration) || (recording && (!canReconcile(report) || !by.trim() || !at)) || (!recording && !validCashAmount(counted)) || (counted !== '' && !validCashAmount(counted)) || (editing && !notes.trim())}>{saving ? 'Saving…' : recording ? editing ? 'Save correction' : 'Save handover' : 'Submit owner count'}</button>
      {editing && <button type="button" style={{ ...button, marginLeft:8, background:'#666' }} disabled={saving} onClick={()=>{setEditing(false);setCounted('');setNotes('')}}>Cancel correction</button>}
    </>}
    {error && <p role="alert" style={{ color:'#a11' }}>{error}</p>}
    {message && <p role="status">{message}</p>}
    <details style={{ marginTop:14 }}><summary style={{ cursor:'pointer', fontWeight:700 }}>Audit history ({rows.length})</summary>
      {rows.length === 0 && <p>No handover recorded for this date.</p>}
      {rows.map(row=><article key={row.id} style={{ borderBottom:'1px solid #ddd', padding:'10px 0', fontSize:12, overflowWrap:'anywhere' }}>
        <strong>Revision {row.revision} · {cashVariances(row.system_expected_cash, row.cash_handed_over, row.owner_physical_count).status}</strong>
        <p>Expected {peso(row.system_expected_cash)} · Handed {peso(row.cash_handed_over)} · Count {row.owner_physical_count == null ? 'Pending' : peso(row.owner_physical_count)}</p>
        <p>Collection {peso(row.collection_variance)} · Counting {row.counting_variance == null ? 'Pending' : peso(row.counting_variance)} · Final {row.final_variance == null ? 'Pending' : peso(row.final_variance)}</p>
        <p>Handover {time(row.handover_at)} · By {row.handed_over_by} · Received by {row.received_by} · Recorded {time(row.created_at)}</p>
        {row.owner_count_at && <p>Count submitted {time(row.owner_count_at)}</p>}
        {row.notes && <p>{row.notes}</p>}
        {row.previous_id && <small>Supersedes {row.previous_id}</small>}
      </article>)}
    </details>
  </section>
}
