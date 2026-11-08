import { useEffect, useState } from 'react'

const friendly = (value) => String(value).replace(/_/g, ' ').replace(/\b\w/g, match => match.toUpperCase())
const asText = (value) => {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
const money = value => '₱' + Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function FieldGrid({ data }) {
  const entries = Object.entries(data || {}).filter(([, value]) => value !== undefined)
  if (!entries.length) return <p style={{ color:'#777', fontSize:12 }}>No details were captured for this section.</p>
  return (
    <dl style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8, margin:0 }}>
      {entries.map(([key, value]) => (
        <div key={key} style={{ minWidth:0, background:'#f7f7f7', borderRadius:7, padding:'8px 10px' }}>
          <dt style={{ fontSize:10, fontWeight:800, color:'#666', marginBottom:4 }}>{friendly(key)}</dt>
          <dd style={{ fontSize:12, color:'#252525', margin:0, whiteSpace:'pre-wrap', overflowWrap:'anywhere' }}>{asText(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function PreviewSection({ title, children }) {
  return <section style={{ marginTop:18 }}>
    <h3 style={{ color:'#1a1a2e', fontSize:14, margin:'0 0 8px', borderBottom:'1px solid #e3e3e3', paddingBottom:6 }}>{title}</h3>
    {children}
  </section>
}

/**
 * Read-only preview based on the immutable snapshot captured by the invoice
 * deletion request procedure. The preview never calls a write operation.
 */
export default function InvoiceDeletionPreviewButton({ request, disabled = false, sortItems }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const snapshot = request?.invoice_snapshot || {}
  const invoice = snapshot.invoice && typeof snapshot.invoice === 'object' ? snapshot.invoice : {}
  const items = Array.isArray(snapshot.items) ? snapshot.items : []
  // Mirror the standard invoice viewer's approved product order without altering saved records.
  const displayItems = typeof sortItems === 'function' ? sortItems(items) : items
  const linkedOrders = Array.isArray(snapshot.linked_orders) ? snapshot.linked_orders : []
  const movement = snapshot.movement || {}
  const available = !!Object.keys(invoice).length
  const btnStyle = { width:'auto', marginTop:0, padding:'8px 12px', fontSize:10,
    background:'white', color:'#1d4ed8', border:'1px solid #1d4ed8',
    borderRadius:7, fontWeight:800, cursor:'pointer' }

  return <>
    <button type="button" style={btnStyle} disabled={disabled}
      onClick={() => setOpen(true)} aria-label={`View all details of invoice ${request.invoice_number}`}>
      View Invoice
    </button>
    {open && <div role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) setOpen(false)
    }} style={{ position:'fixed', inset:0, zIndex:100001, background:'rgba(0,0,0,.68)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
      <div role="dialog" aria-modal="true" aria-label={`Invoice ${request.invoice_number} details`}
        style={{ background:'white', color:'#252525', width:'min(950px, 100%)',
          maxHeight:'min(90vh, 950px)', overflowY:'auto', borderRadius:14,
          padding:'18px 20px', boxShadow:'0 12px 40px rgba(0,0,0,.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>
          <div>
            <h2 style={{ margin:'0 0 5px', fontSize:20, color:'#1a1a2e' }}>Invoice {request.invoice_number}</h2>
            <p style={{ margin:0, fontSize:12, color:'#666' }}>Read-only invoice details captured when the deletion request was submitted</p>
            <p style={{ margin:'5px 0 0', fontSize:12, fontWeight:800 }}>Requested by {request.requested_by_name || 'Unknown'} — {request.reseller_name || invoice.customer_name || 'Customer'}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} autoFocus
            style={{ border:0, background:'#f2f2f2', color:'#222', padding:'8px 11px', borderRadius:7, cursor:'pointer', fontWeight:800 }}>Close ×</button>
        </div>
        <div style={{ background:'#fff6df', padding:12, marginTop:14, borderRadius:9, border:'1px solid #f5d789' }}>
          <strong style={{ fontSize:13 }}>Invoice total: {money(invoice.total_amount ?? request.total_amount)}</strong>
          <p style={{ fontSize:11, margin:'5px 0 0' }}>Deletion request status: {friendly(request.status || 'pending')} · Invoice status at request: {friendly(request.invoice_status_at_request || invoice.status || 'unknown')}</p>
          <p style={{ fontSize:11, margin:'5px 0 0' }}>Reason: {asText(request.reason_detail)}</p>
        </div>
        {!available && <p role="alert" style={{ color:'#b45309', marginTop:15, fontSize:12 }}>
          The invoice snapshot is unavailable. Do not approve deletion until its details have been verified.
        </p>}
        <PreviewSection title="Full invoice information"><FieldGrid data={invoice} /></PreviewSection>
        <PreviewSection title={`Invoice line items (${items.length})`}>
          {items.length ? <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr style={{ background:'#f4f4f4', textAlign:'left' }}>
                {['Product / variant','Quantity','Unit price','Line total'].map(v=><th key={v} style={{ padding:9 }}>{v}</th>)}
              </tr></thead>
              <tbody>{displayItems.map((item,index)=>(
                <tr key={item.id || index} style={{ borderBottom:'1px solid #ececec' }}>
                  <td style={{ padding:9 }}>{asText(item.variant_name || item.product_name || item.name)}</td>
                  <td style={{ padding:9 }}>{asText(item.quantity)}</td>
                  <td style={{ padding:9 }}>{item.unit_price == null ? '—' : money(item.unit_price)}</td>
                  <td style={{ padding:9 }}>{item.total_price == null && item.subtotal == null ? '—' : money(item.total_price ?? item.subtotal)}</td>
                </tr>
              ))}</tbody>
            </table>
            <details style={{ marginTop:10 }}><summary style={{ cursor:'pointer', fontSize:12 }}>Show every recorded line-item field</summary>
              {displayItems.map((item,index)=><div key={item.id || index} style={{ marginTop:8 }}><strong style={{ fontSize:12 }}>Item {index+1}</strong><FieldGrid data={item} /></div>)}
            </details>
          </div> : <p style={{ fontSize:12, color:'#777' }}>No line items recorded in the request snapshot.</p>}
        </PreviewSection>
        <PreviewSection title="Linked orders"><div>{linkedOrders.length ? linkedOrders.map((order,index)=><div key={order.id || index} style={{ marginBottom:7 }}><FieldGrid data={order} /></div>) : <p style={{ fontSize:12, color:'#777' }}>No linked orders in snapshot.</p>}</div></PreviewSection>
        <PreviewSection title="Payments, returns and financial movement"><FieldGrid data={movement} /></PreviewSection>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:20 }}>
          <button type="button" onClick={() => setOpen(false)} style={{ background:'#1a1a2e', border:0, borderRadius:8, padding:'10px 20px', fontWeight:800, color:'white', cursor:'pointer' }}>Close Preview</button>
        </div>
      </div>
    </div>}
  </>
}
