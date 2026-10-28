import { seasonalBoxFor } from './seasonalBoxPolicy.js'
import { useCallback, useState } from 'react'
import { isSagsTransferSchemaMissing } from './sagsTransferForecast.js'

const OUTLET_ID = 'OUTLET-MALUED'
const canDispatch = role => ['owner', 'manager', 'admin'].includes(String(role || '').toLowerCase())
const canReceive = role => ['owner', 'manager', 'admin', 'pos_admin'].includes(String(role || '').toLowerCase())
const dateInManila = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export default function SagsInternalTransfers({ supabase, adminRole, onReceived }) {
  const [open, setOpen] = useState(false)
  const [transfers, setTransfers] = useState([])
  const [schemaAvailable, setSchemaAvailable] = useState(null)
  const [variants, setVariants] = useState([])
  const [products, setProducts] = useState([])
  const [date, setDate] = useState(dateInManila)
  const [dispatcher, setDispatcher] = useState('')
  const [receiver, setReceiver] = useState('')
  const [receiptNotes, setReceiptNotes] = useState('')
  const [actualQty, setActualQty] = useState({})
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ variant_id:'', pos_product_id:'', quantity:'' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())

  const refresh = useCallback(async () => {
    const [transferResult, variantResult, productResult] = await Promise.all([
      supabase.from('sags_internal_transfers').select('*,sags_internal_transfer_items(*)').order('delivery_date', { ascending:false }).order('created_at', { ascending:false }).limit(100),
      supabase.from('donut_variants').select('id,name').eq('is_active', true).order('name'),
      supabase.from('pos_products').select('id,product_name,category,outlet_id').eq('is_active', true).eq('outlet_id', OUTLET_ID).order('product_name')
    ])
    if (isSagsTransferSchemaMissing(transferResult.error)) {
      setSchemaAvailable(false)
      setTransfers([])
      return
    }
    const failure = transferResult.error || variantResult.error || productResult.error
    if (failure) throw failure
    setSchemaAvailable(true)
    setTransfers(transferResult.data || [])
    setVariants(variantResult.data || [])
    setProducts((productResult.data || []).filter(row => String(row.category || '').toLowerCase() === 'donuts'))
  }, [supabase])

  const updateItem = (index, change) => setItems(current => current.map((item, at) => at === index ? { ...item, ...change } : item))
  const save = async () => {
    setError(''); setMessage('')
    const valid = items.filter(item => item.variant_id && Number(item.quantity) > 0)
    if (!date || !valid.length || valid.length !== items.length || valid.some(item => !item.pos_product_id || !Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) <= 0)) {
      setError('Enter a date, a POS donut match, and a whole positive quantity for every row.'); return
    }
    if (new Set(valid.map(item => item.variant_id)).size !== valid.length || new Set(valid.map(item => item.pos_product_id)).size !== valid.length) {
      setError('Each donut variant and POS product can appear only once per transfer.'); return
    }
    setBusy(true)
    try {
      const { error:saveError } = await supabase.rpc('create_sags_internal_transfer', {
        p_request_id:requestId, p_delivery_date:date, p_dispatched_by:dispatcher,
        p_notes:notes, p_items:valid.map(item => ({ variant_id:item.variant_id, pos_product_id:item.pos_product_id, quantity:Number(item.quantity) }))
      })
      if (saveError) throw saveError
      setRequestId(crypto.randomUUID())
      setItems([{ variant_id:'', pos_product_id:'', quantity:'' }]); setNotes(''); setDispatcher('')
      setMessage('Transfer saved. SAGS must confirm receipt before POS stock increases.')
      await refresh()
    } catch (err) { setError(err.message || 'Transfer could not be saved. Retry with the same details.') }
    finally { setBusy(false) }
  }

  const receive = async transfer => {
    const name = receiver.trim()
    if (!name) { setError('Enter the name of the person who physically received the donuts.'); return }
    const lines = transfer.sags_internal_transfer_items || []
    const actual = lines.map(line => ({ id:line.id, quantity:Number(actualQty[line.id] ?? line.quantity) }))
    if (actual.some((line, index) => !Number.isSafeInteger(line.quantity) || line.quantity < 0 || line.quantity > Number(lines[index].quantity)) || actual.every(line => line.quantity === 0)) {
      setError('Enter a whole actual quantity from 0 up to the dispatched units for every item. At least one unit must be received.'); return
    }
    const dispatched = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
    const qty = actual.reduce((sum, line) => sum + line.quantity, 0)
    if (qty !== dispatched && receiptNotes.trim().length < 5) { setError('Explain the quantity difference in receipt notes.'); return }
    if (!window.confirm(`Confirm ${qty} actual units received out of ${dispatched} dispatched for ${transfer.transfer_number}? This will add only the actual units to SAGS POS stock once.`)) return
    setError(''); setMessage(''); setBusy(true)
    try {
      const { error:receiveError } = await supabase.rpc('receive_sags_internal_transfer', { p_transfer_id:transfer.id, p_received_by:name, p_actual_items:actual, p_receipt_notes:receiptNotes.trim() })
      if (receiveError) throw receiveError
      setReceiver('')
      setReceiptNotes(''); setActualQty({})
      setMessage(`${transfer.transfer_number} received. POS stock increased once; no sale was posted.`)
      await refresh()
      if (onReceived) await onReceived()
    } catch (err) { setError(err.message || 'Receiving failed. Check the record before retrying.') }
    finally { setBusy(false) }
  }

  const control = { padding:'7px 9px', border:'1px solid #d1d5db', borderRadius:7, minWidth:0, fontSize:12, background:'#fff' }
  return <section style={{ background:'#fff', border:'1px solid #f1e1a6', borderRadius:12, padding:12, marginBottom:12 }}>
    <button type="button" onClick={() => { if (!open) refresh().catch(err => setError(err.message || 'Unable to load SAGS transfers.')); setOpen(value => !value) }} style={{ border:0, background:'transparent', color:'#9b1717', fontWeight:900, fontSize:16, cursor:'pointer', padding:0 }}>
      {open ? '▾' : '▸'} SAGS Internal Transfers
    </button>
    <p style={{ fontSize:12, color:'#555', margin:'5px 0 0' }}>Record donuts sent to SAGS without a reseller invoice or sales amount. POS records the sale when a customer buys them. For Spooky Donuts, enter whole boxes; POS stock and sales are counted in boxes, while production expands the contents.</p>
    {open && <div style={{ marginTop:12 }}>
      {error && <p role="alert" style={{ color:'#b91c1c', fontWeight:700 }}>{error}</p>}
      {message && <p role="status" style={{ color:'#166534', fontWeight:700 }}>{message}</p>}
      {schemaAvailable === false && <p role="status" style={{ fontSize:12, color:'#92400e' }}>Internal Transfers await database setup. Use the existing SAGS delivery invoice flow until this feature is activated.</p>}
      {schemaAvailable && canDispatch(adminRole) && <div style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:10, marginBottom:14 }}>
        <strong>New delivery to SAGS</strong>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', margin:'9px 0' }}>
          <label>Delivery date <input type="date" value={date} onChange={event => setDate(event.target.value)} style={control} /></label>
          <label>Dispatched by <input value={dispatcher} onChange={event => setDispatcher(event.target.value)} style={control} /></label>
          <label>Notes <input value={notes} onChange={event => setNotes(event.target.value)} style={control} /></label>
        </div>
        {items.map((item, index) => <div key={index} style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'center', marginBottom:7 }}>
          <select aria-label={`Donut variant ${index+1}`} value={item.variant_id} onChange={event => {
            const selected = variants.find(variant => variant.id === event.target.value)
            const exact = products.filter(product => product.product_name.trim().toLowerCase() === String(selected?.name || '').trim().toLowerCase())
            updateItem(index, { variant_id:event.target.value, pos_product_id:exact.length === 1 ? exact[0].id : '' })
          }} style={{ ...control, flex:'1 1 170px' }}><option value="">Select donut</option>{variants.map(variant => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select>
          <select aria-label={`SAGS POS product ${index+1}`} value={item.pos_product_id} onChange={event => updateItem(index, { pos_product_id:event.target.value })} style={{ ...control, flex:'1 1 170px' }}><option value="">Match POS donut</option>{products.map(product => <option key={product.id} value={product.id}>{product.product_name}</option>)}</select>
          <input aria-label={`${seasonalBoxFor(variants.find(v => v.id === item.variant_id)) ? 'Boxes' : 'Pieces'} ${index+1}`} type="number" min="1" step="1" placeholder={seasonalBoxFor(variants.find(v => v.id === item.variant_id)) ? 'Boxes' : 'Pieces'} value={item.quantity} onChange={event => updateItem(index, { quantity:event.target.value })} style={{ ...control, width:85 }} />
          <button type="button" onClick={() => setItems(current => current.filter((_, at) => at !== index))} disabled={items.length === 1} style={control}>Remove</button>
        </div>)}
        <div style={{ display:'flex', gap:8, alignItems:'center' }}><button type="button" onClick={() => setItems(current => [...current, { variant_id:'', pos_product_id:'', quantity:'' }])} style={control}>Add item</button>
          <button type="button" onClick={save} disabled={busy} style={{ ...control, color:'white', background:'#2d8a4e', fontWeight:800 }}>{busy ? 'Saving...' : 'Save transfer'}</button></div>
      </div>}
      {schemaAvailable && <><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}><strong>Recent transfers</strong><button type="button" onClick={() => refresh().catch(err => setError(err.message))} style={control}>Refresh</button></div>
      {canReceive(adminRole) && <label style={{ display:'block', fontSize:12, margin:'8px 0' }}>Received by <input value={receiver} onChange={event => setReceiver(event.target.value)} placeholder="Name of receiving staff" style={control} /></label>}
      {transfers.length === 0 && <p style={{ fontSize:12 }}>No internal transfer recorded yet.</p>}
      {transfers.map(transfer => <div key={transfer.id} style={{ borderTop:'1px solid #eee', padding:'10px 0', fontSize:12 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}><b>{transfer.transfer_number}</b><span>{transfer.delivery_date}</span><b style={{ color:transfer.status === 'received' ? '#166534' : '#9a3412' }}>{transfer.status.toUpperCase()}</b>
          {transfer.status === 'dispatched' && canReceive(adminRole) && <button type="button" disabled={busy} onClick={() => receive(transfer)} style={{ ...control, color:'white', background:'#2d8a4e' }}>Confirm receipt</button>}</div>
        <p style={{ margin:'5px 0' }}>{(transfer.sags_internal_transfer_items || []).map(line => `${line.variant_name} → ${products.find(product => product.id === line.pos_product_id)?.product_name || line.pos_product_id}: ${line.quantity} ${seasonalBoxFor(line) ? 'boxes' : 'pcs'}`).join(' · ')}</p>
        {transfer.status === 'dispatched' && canReceive(adminRole) && <div style={{ display:'flex', flexWrap:'wrap', gap:8, margin:'6px 0' }}>
          {(transfer.sags_internal_transfer_items || []).map(line => <label key={line.id}>Actual {line.variant_name} <input type="number" min="0" max={line.quantity} step="1" value={actualQty[line.id] ?? line.quantity} onChange={event => setActualQty(current => ({ ...current, [line.id]:event.target.value }))} style={{ ...control, width:70 }} /></label>)}
          <label>Difference reason <input value={receiptNotes} onChange={event => setReceiptNotes(event.target.value)} placeholder="Required if quantities differ" style={control} /></label>
        </div>}
        {transfer.status === 'received' && <p style={{ margin:'5px 0', color:'#166534' }}>Actual received: {(transfer.sags_internal_transfer_items || []).map(line => `${line.variant_name} ${line.received_quantity} pcs`).join(' · ')}{transfer.receipt_notes ? ` · Difference: ${transfer.receipt_notes}` : ''}</p>}
        <small>Dispatched: {transfer.dispatched_by || 'Unspecified'} · Received: {transfer.received_by || 'Pending'}{transfer.notes ? ` · ${transfer.notes}` : ''}</small>
      </div>)}
      {transfers.length === 100 && <p style={{ fontSize:11 }}>Showing the latest 100 transfers.</p>}
      </>}
    </div>}
  </section>
}
