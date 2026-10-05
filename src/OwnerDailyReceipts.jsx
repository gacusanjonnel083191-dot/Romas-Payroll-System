import { useCallback, useEffect, useRef, useState } from 'react'
import { buildOwnerDailyReceipts } from './ownerDailyReceipts'

const peso = amount => '₱' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits:2, maximumFractionDigits:2 })
const card = { background:'#fff', border:'1px solid #e7e7e7', borderRadius:12, padding:'12px 14px' }
const th = { textAlign:'left', padding:'9px 10px', color:'#fff', fontSize:11, whiteSpace:'nowrap' }
const td = { textAlign:'left', padding:'9px 10px', borderBottom:'1px solid #eee', fontSize:12, verticalAlign:'top' }
const amountTh = { ...th, textAlign:'right' }
const amountTd = { ...td, textAlign:'right', fontWeight:700, whiteSpace:'nowrap' }
const timestamp = value => value ? new Date(value).toLocaleString('en-PH', { timeZone:'Asia/Manila', dateStyle:'medium', timeStyle:'short' }) : '—'

export default function OwnerDailyReceipts({ supabase, today, adminRole }) {
  const [date, setDate] = useState(today)
  const [raw, setRaw] = useState(null)
  const [loadedDate, setLoadedDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestRef = useRef(0)
  const owner = String(adminRole || '').toLowerCase() === 'owner'

  const load = useCallback(async (selectedDate) => {
    if (!owner || !selectedDate) return
    const requestId = ++requestRef.current
    setLoading(true); setError('')
    try {
      const { data, error:requestError } = await supabase.rpc('owner_daily_receipts', { p_day:selectedDate })
      if (requestId !== requestRef.current) return
      if (requestError) { setRaw(null); setError('Daily receipts could not be loaded: ' + requestError.message) }
      else { setRaw(data || {}); setLoadedDate(selectedDate) }
    } catch (requestError) {
      if (requestId === requestRef.current) { setRaw(null); setError('Daily receipts could not be loaded: ' + (requestError?.message || requestError)) }
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [owner, supabase])
  useEffect(() => { if (owner) queueMicrotask(() => void load(date)) }, [date, owner, load])
  if (!owner) return null
  const report = raw && loadedDate === date ? buildOwnerDailyReceipts(raw, date) : null
  const totals = report?.totals || {}
  const cards = [
    ['Cash payments recorded', totals.cash, '#176b3a'],
    ['GCash payments recorded', totals.gcash, '#1459a5'],
    ['Other online payments recorded', totals.otherOnline, '#5d4aaf'],
    ['Total payments recorded', totals.totalReceived, '#1a1a2e'],
    ['From resellers', totals.resellerReceived, '#aa5618'],
    ['Actual company cash counted', report?.actualCashCount, '#1a1a2e'],
    ['Sales entered today', totals.salesEntered, '#ca1b1b'],
    ['Delivered, still unpaid', report?.deliveredUnpaid, '#a45b00']
  ]

  return <section style={{ background:'#f8f9fb', border:'2px solid #f5c518', borderRadius:16, padding:16, marginBottom:18 }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:12 }}>
      <div>
        <h3 style={{ margin:'0 0 4px', color:'#1a1a2e', fontSize:18 }}>Owner daily receipts</h3>
        <p style={{ margin:0, color:'#666', fontSize:12 }}>Recorded payments follow payment date. Sales entered follows Manila entry date.</p>
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <input aria-label="Daily receipts date" type="date" value={date} max={today} onChange={event=>setDate(event.target.value)} style={{ padding:8, minHeight:40, border:'1px solid #ccc', borderRadius:7 }} />
        <button type="button" onClick={()=>load(date)} disabled={loading} style={{ padding:'9px 14px', minHeight:40, border:0, borderRadius:7, background:'#1a1a2e', color:'#fff', fontWeight:700, cursor:'pointer' }}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
    </div>
    {error && <p role="alert" style={{ background:'#fff2f2', color:'#a11', borderRadius:8, padding:10 }}>{error}</p>}
    {loading && !report && <p role="status">Loading daily receipts…</p>}
    {report && <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:9, marginBottom:12 }}>
        {cards.map(([label,value,color])=><div key={label} style={card}>
          <div style={{ fontSize:11, color:'#666', marginBottom:5 }}>{label}</div>
          <strong style={{ color, fontSize:18 }}>{value === null || value === undefined ? 'Not counted' : peso(value)}</strong>
        </div>)}
      </div>
      <p style={{ background:'#eaf3ff', border:'1px solid #c9def6', borderRadius:8, padding:'10px 12px', margin:'0 0 12px', color:'#263b59', fontSize:12 }}>
        <strong>Why these totals can differ:</strong> Payments recorded today can settle sales from earlier dates. Sales entered today includes newly encoded invoices even if they are still unpaid, plus backdated sales encoded today. They are separate totals and are not expected to match.
      </p>
      <p style={{ fontSize:11, color:'#555', margin:'4px 0 12px' }}>
        Payment totals come from recorded tenders and collections; they do not prove cash was physically handed to the owner. Delivered but unpaid invoices are excluded. Actual company cash counted is shown only after a Cash Reconciliation is submitted for this date. POS drawer counts are outlet-specific and include opening cash.
      </p>
      {(totals.unknown > 0 || totals.unpaid > 0 || totals.trackingOnly > 0) && <div style={{ ...card, background:'#fff8e7', marginBottom:12, fontSize:12 }}>
        <strong>Needs review:</strong> {peso(totals.unknown)} sales or payments with no confirmed payment method · {peso(totals.unpaid)} Daily Sales marked unpaid · {peso(totals.trackingOnly)} legacy online records without a duplicate-receipt choice. These are excluded from confirmed cash and online totals to avoid guessing or double-counting.
      </div>}
      {totals.duplicateTracked > 0 && <p style={{ fontSize:11, color:'#666' }}>{peso(totals.duplicateTracked)} online tracking entries are already included in a Daily Sales payment split and are not counted twice.</p>}
      <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:12, fontSize:12 }}>
        <span>Bank deposits recorded: <strong>{peso(report.bankDeposits)}</strong></span>
        <span>Approved expenses: <strong>{peso(report.approvedExpenses)}</strong> (payment method not recorded)</span>
        {report.cashCountAt && <span>Cash count submitted: <strong>{timestamp(report.cashCountAt)}</strong></span>}
      </div>
      <details open style={{ ...card, marginBottom:10 }}>
        <summary style={{ fontWeight:700, cursor:'pointer' }}>Payments received on {date} ({report.receipts.length})</summary>
        <div style={{ overflowX:'auto', marginTop:10 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:650 }}>
            <thead style={{ background:'#1a1a2e' }}><tr>{['Source','Customer / outlet','Method','Amount','Entered'].map(label=><th key={label} style={label === 'Amount' ? amountTh : th}>{label}</th>)}</tr></thead>
            <tbody>{report.receipts.map(row=><tr key={row.id}><td style={td}>{row.source}</td><td style={td}>{row.description}</td><td style={td}>{row.method}</td><td style={amountTd}>{peso(row.amount)}</td><td style={td}>{timestamp(row.enteredAt)}</td></tr>)}</tbody>
          </table>
          {report.receipts.length === 0 && <p style={{ fontSize:12, color:'#777', padding:8 }}>No receipts recorded for this date.</p>}
        </div>
      </details>
      <details style={card}>
        <summary style={{ fontWeight:700, cursor:'pointer' }}>Sales and payments entered on {date} ({report.entered.length})</summary>
        <p style={{ color:'#666', fontSize:11 }}>Includes backdated entries made on this date. This activity list is separate from the received-money totals.</p>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:620 }}>
            <thead style={{ background:'#1a1a2e' }}><tr>{['Entry','Customer / outlet','Business date','Amount','Entered'].map(label=><th key={label} style={label === 'Amount' ? amountTh : th}>{label}</th>)}</tr></thead>
            <tbody>{report.entered.map(row=><tr key={row.id}><td style={td}>{row.source}</td><td style={td}>{row.description}</td><td style={td}>{row.businessDate || '—'}</td><td style={amountTd}>{peso(row.amount)}</td><td style={td}>{timestamp(row.enteredAt)}</td></tr>)}</tbody>
          </table>
          {report.entered.length === 0 && <p style={{ fontSize:12, color:'#777', padding:8 }}>No sales or payment entries recorded on this date.</p>}
        </div>
      </details>
    </>}
  </section>
}
