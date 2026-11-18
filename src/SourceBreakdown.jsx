import { useEffect, useRef } from 'react'
export const sourcePeso = value => '₱' + Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits:2, maximumFractionDigits:2 })

// Read-only: callers supply the exact rows used by their summary calculation.
export default function SourceBreakdown({ title, rows = [], total, explanation, onOpenInvoice, onClose }) {
  const heading = useRef(null)
  useEffect(() => { heading.current?.focus({ preventScroll:true }) }, [title])
  const sum = Math.round(rows.reduce((n,row)=>n + Number(row.amount || 0),0)*100)/100
  const matches = total == null || Math.abs(sum - Number(total)) < 0.005
  return <section aria-label={title} style={{ background:'#fff', color:'#333', border:'1px solid #ddd', borderRadius:12, padding:14, margin:'12px 0', textAlign:'left' }}>
    <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
      <h4 ref={heading} tabIndex={-1} style={{ margin:'0 0 8px' }}>{title}</h4>
      {onClose && <button type="button" onClick={onClose}>Close details</button>}
    </div>
    <p style={{ fontSize:12 }}>{explanation}</p>
    <p style={{ fontSize:12 }}><strong>{rows.length} source records · {sourcePeso(sum)}</strong>{total != null && <> · Summary: {sourcePeso(total)} · {matches ? 'Matches' : 'Does not match — review required'}</>}</p>
    {!rows.length && <p>No contributing records for this selection. A missing cash count does not mean zero was counted.</p>}
    <div style={{ maxHeight:460, overflowY:'auto' }}>
      {rows.map((row,index)=><article key={`${row.id}-${index}`} style={{ padding:'12px 0', borderTop:'1px solid #eee', overflowWrap:'anywhere', fontSize:12 }}>
        <strong>{row.description || row.invoiceNumber || row.source}</strong><strong style={{ float:'right', marginLeft:8 }}>{sourcePeso(row.amount)}</strong>
        <p style={{ margin:'5px 0' }}>{row.source} · {row.businessDate || 'Date unavailable'}{row.method ? ` · ${row.method}` : ''}</p>
        {row.invoiceNumber && <p style={{ margin:'5px 0' }}>Invoice: {row.invoiceNumber}</p>}
        {row.recordId && <p style={{ margin:'5px 0' }}>Record: {row.recordId}</p>}
        <p style={{ margin:'5px 0' }}>Entered by: {row.recordedBy || 'Not available in source'}{row.enteredAt ? ` · ${new Date(row.enteredAt).toLocaleString('en-PH', {timeZone:'Asia/Manila'})}` : ''}</p>
        {row.detail && <p style={{ margin:'5px 0' }}>{row.detail}</p>}
        {row.invoiceId && onOpenInvoice && <button type="button" onClick={()=>onOpenInvoice(row.invoiceId)} style={{ minHeight:44, cursor:'pointer' }}>View invoice details</button>}
      </article>)}
    </div>
  </section>
}
