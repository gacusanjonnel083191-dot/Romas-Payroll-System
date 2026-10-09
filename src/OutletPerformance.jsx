import { useEffect, useMemo, useRef, useState } from 'react'
import { buildOutletDeliveryHistory, calculateOutletClosingLine, getOutletSlowWeekdays, outletWeekdayStats } from './outletPerformance.js'
import './OutletPerformance.css'

const peso = value => new Intl.NumberFormat('en-PH', { style:'currency', currency:'PHP' }).format(Number(value) || 0)
const number = value => new Intl.NumberFormat('en-PH').format(Number(value) || 0)
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
const countedInvoice = invoice => !['cancelled', 'void', 'voided', 'deleted'].includes(String(invoice.status || '').toLowerCase())
const itemKey = item => String(item.product_key || `${item.source || 'donut_variant'}:${item.product_id || item.id || ''}`)

function makeDateRange(end, days) {
  const last = new Date(`${end}T12:00:00Z`)
  const first = new Date(last)
  first.setUTCDate(first.getUTCDate() - days + 1)
  return first.toISOString().slice(0, 10)
}

export default function OutletPerformance({ client, resellers, products, adminLabel, today }) {
  const [outletId, setOutletId] = useState('')
  const [closingDate, setClosingDate] = useState(today)
  const [rangeDays, setRangeDays] = useState(90)
  const [metric, setMetric] = useState('sold_qty')
  const [sourceChoice, setSourceChoice] = useState('')
  const [rows, setRows] = useState([])
  const [deliveryRows, setDeliveryRows] = useState([])
  const [graphLoading, setGraphLoading] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formRows, setFormRows] = useState([])
  const [previousDate, setPreviousDate] = useState('')
  const [existing, setExisting] = useState(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const saveLock = useRef(false)
  const catalog = products
  const selectedOutletId = outletId || resellers[0]?.id || ''

  useEffect(() => {
    let active = true
    async function load() {
      setGraphLoading(true)
      setError('')
      const start = makeDateRange(today, rangeDays)
      if (!selectedOutletId) { setRows([]); setDeliveryRows([]); setGraphLoading(false); return }
      const [closingResult, invoiceResult] = await Promise.all([
        client.from('outlet_daily_closings').select('*').eq('reseller_id', selectedOutletId).gte('business_date', start).lte('business_date', today).order('business_date', { ascending:true }).limit(1000),
        client.from('delivery_invoices').select('id,delivery_date,status,total_amount,delivery_invoice_items(variant_id,variant_name,quantity,total_price,reseller_price)').eq('reseller_id', selectedOutletId).gte('delivery_date', start).lte('delivery_date', today).order('delivery_date', { ascending:true }).limit(1000),
      ])
      if (!active) return
      setRows(closingResult.data || [])
      setDeliveryRows(buildOutletDeliveryHistory(invoiceResult.data || []))
      if (closingResult.error || invoiceResult.error) setError(`Outlet history could not load: ${(closingResult.error || invoiceResult.error).message}`)
      setGraphLoading(false)
    }
    load()
    return () => { active = false }
  }, [client, selectedOutletId, rangeDays, today])

  useEffect(() => {
    let active = true
    async function loadClosing() {
      setFormRows([])
      setExisting(null)
      setPreviousDate('')
      if (!selectedOutletId || !validDate(closingDate)) return
      setFormLoading(true)
      const [saved, previous, invoices] = await Promise.all([
        client.from('outlet_daily_closings').select('*').eq('reseller_id', selectedOutletId).eq('business_date', closingDate).maybeSingle(),
        client.from('outlet_daily_closings').select('business_date,items').eq('reseller_id', selectedOutletId).lt('business_date', closingDate).order('business_date', { ascending:false }).limit(1).maybeSingle(),
        client.from('delivery_invoices').select('id,status,delivery_invoice_items(variant_id,variant_name,quantity)').eq('reseller_id', selectedOutletId).eq('delivery_date', closingDate).limit(500),
      ])
      if (!active) return
      const failure = [saved, previous, invoices].find(result => result.error)
      if (failure) { setError(`Daily closing source could not load: ${failure.error.message}`); setFormLoading(false); return }
      setExisting(saved.data || null)
      setPreviousDate(previous.data?.business_date || '')
      if (saved.data) {
        setFormRows(saved.data.items || [])
        setFormLoading(false)
        return
      }
      const prior = new Map((previous.data?.items || []).map(item => [itemKey(item), item]))
      const delivered = new Map()
      const deliveredNames = new Map()
      ;(invoices.data || []).filter(countedInvoice).forEach(invoice => (invoice.delivery_invoice_items || []).forEach(item => {
        const key = item.variant_id ? `donut_variant:${item.variant_id}` : `donut_variant:${String(item.variant_name || '').trim().toLowerCase()}`
        delivered.set(key, (delivered.get(key) || 0) + Number(item.quantity || 0))
        deliveredNames.set(key, item.variant_name || 'Invoice product')
      }))
      const productMap = new Map(catalog.map(product => [itemKey(product), product]))
      prior.forEach((item, key) => { if (!productMap.has(key)) productMap.set(key, item) })
      deliveredNames.forEach((name, key) => { if (!productMap.has(key)) productMap.set(key, { product_name:name, default_price:0 }) })
      const prepared = [...productMap].map(([key, product]) => {
        const beginning = Number(prior.get(key)?.ending || 0)
        const autoDelivered = Number(delivered.get(key) || 0)
        return {
          product_key:key, product_name:product.product_name || product.name || key,
          beginning, delivered:autoDelivered, manualDelivered:0, wastage:0,
          ending:'', price:Number(product.default_price ?? product.price ?? prior.get(key)?.price ?? 0),
        }
      }).filter(item => item.beginning > 0 || item.delivered > 0)
      setFormRows(prepared)
      setFormLoading(false)
    }
    loadClosing()
    return () => { active = false }
  }, [client, selectedOutletId, closingDate, catalog])

  const sourceMode = sourceChoice || (rows.length ? 'closings' : 'deliveries')
  const isDeliveryHistory = sourceMode === 'deliveries'
  const metricKey = isDeliveryHistory ? (metric === 'sold_qty' ? 'delivered_qty' : 'invoiced_amount') : metric
  const metricLabel = isDeliveryHistory ? (metric === 'sold_qty' ? 'pieces delivered' : 'invoiced amount') : (metric === 'sold_qty' ? 'pieces sold' : 'calculated sales')
  const visibleRows = useMemo(() => isDeliveryHistory ? deliveryRows : rows.filter(row => row.reseller_id === selectedOutletId), [deliveryRows, isDeliveryHistory, rows, selectedOutletId])
  const selected = visibleRows.find(row => row.id === selectedId) || visibleRows.at(-1) || null
  const weekdayRows = useMemo(() => outletWeekdayStats(visibleRows, metricKey), [visibleRows, metricKey])
  const slowDays = useMemo(() => getOutletSlowWeekdays(visibleRows, metricKey), [visibleRows, metricKey])
  const maxValue = Math.max(1, ...visibleRows.map(row => Number(row[metricKey]) || 0))
  const maxWeekday = Math.max(1, ...weekdayRows.map(row => row.average || 0))
  const maxDayPoints = 80
  const chartRows = visibleRows.length > maxDayPoints ? visibleRows.slice(-maxDayPoints) : visibleRows
  const chartStart = Date.parse(`${chartRows[0]?.business_date || today}T12:00:00Z`)
  const chartEnd = Date.parse(`${chartRows.at(-1)?.business_date || today}T12:00:00Z`)
  const xForDate = date => 40 + (Date.parse(`${date}T12:00:00Z`) - chartStart) / Math.max(86400000, chartEnd - chartStart) * 740
  const yForRow = row => 185 - (Number(row[metricKey]) || 0) / maxValue * 145
  const path = chartRows.map((row, index) => {
    const previous = chartRows[index - 1]
    const gap = previous ? Date.parse(`${row.business_date}T12:00:00Z`) - Date.parse(`${previous.business_date}T12:00:00Z`) : 0
    return `${!index || gap > 86400000 ? 'M' : 'L'}${xForDate(row.business_date)},${yForRow(row)}`
  }).join(' ')
  const dayLookup = new Map(visibleRows.map(row => [row.business_date, row]))
  const calendarDays = Array.from({ length:rangeDays }, (_, index) => {
    const date = new Date(`${makeDateRange(today, rangeDays)}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + index)
    const key = date.toISOString().slice(0, 10)
    return { date:key, closing:dayLookup.get(key) || null }
  })
  const totals = formRows.reduce((sum, row) => {
    if (row.ending === '') return sum
    try {
      const computed = calculateOutletClosingLine(row)
      return { sold:sum.sold + computed.sold, sales:sum.sales + computed.amount }
    } catch { return sum }
  }, { sold:0, sales:0 })

  function changeLine(index, field, value) {
    setFormRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]:value } : row))
  }

  function addProduct(key) {
    const product = catalog.find(item => itemKey(item) === key)
    if (!product || formRows.some(item => item.product_key === key)) return
    setFormRows(current => [...current, {
      product_key:key, product_name:product.product_name || product.name || key,
      beginning:0, delivered:0, manualDelivered:0, wastage:0, ending:'',
      price:Number(product.default_price || 0),
    }])
  }

  async function saveClosing() {
    if (saveLock.current || saving || existing) return
    setError('')
    if (!selectedOutletId || !validDate(closingDate) || closingDate > today) { setError('Select an outlet and a business date up to today.'); return }
    if (!formRows.length) { setError('No stock was found. Add a delivered product or use an existing outlet report.'); return }
    let computed
    try {
      if (formRows.some(row => row.ending === '')) throw new Error('Enter the actual ending count for each listed product.')
      computed = formRows.map(calculateOutletClosingLine)
    } catch (validationError) { setError(validationError.message); return }
    const sold = computed.reduce((sum, row) => sum + row.sold, 0)
    const sales = Math.round(computed.reduce((sum, row) => sum + row.amount, 0) * 100) / 100
    if (!window.confirm(`Save the daily closing for ${closingDate}?\n\nSold: ${number(sold)} pieces\nCalculated sales: ${peso(sales)}\n\nThis record is for performance tracking. It does not post revenue or change an invoice.`)) return
    saveLock.current = true
    setSaving(true)
    try {
      const payload = {
        reseller_id:selectedOutletId, business_date:closingDate,
        items:computed.map(({ product_key, product_name, beginning, delivered, manualDelivered, wastage, ending, price, sold:lineSold, amount }) => ({ product_key, product_name, beginning, delivered, manualDelivered, wastage, ending, price, sold:lineSold, amount })),
        delivered_qty:computed.reduce((sum, row) => sum + row.delivered + row.manualDelivered, 0),
        sold_qty:sold, wastage_qty:computed.reduce((sum, row) => sum + row.wastage, 0),
        sales_amount:sales, notes:notes.trim() || null, recorded_by:adminLabel,
      }
      const { error:saveError } = await client.from('outlet_daily_closings').insert(payload)
      if (saveError) throw saveError
      const { data, error:reloadError } = await client.from('outlet_daily_closings').select('*').eq('reseller_id', selectedOutletId).gte('business_date', makeDateRange(today, rangeDays)).lte('business_date', today).order('business_date', { ascending:true }).limit(1000)
      if (reloadError) throw reloadError
      setRows(data || [])
      setSourceChoice('closings')
      setExisting(payload)
      setNotes('')
    } catch (saveError) {
      setError(saveError.code === '23505' ? 'A closing already exists for this outlet and date. Refresh to inspect it.' : saveError.message)
    } finally { saveLock.current = false; setSaving(false) }
  }

  return <section className="outlet-performance">
    <div className="outlet-performance-header">
      <div><h3>Daily Outlet Performance</h3><p>Compare outlet deliveries now, and actual sell-through as daily physical closings are recorded. Missing dates are never counted as zero.</p></div>
      <div className="outlet-performance-filters">
        <label>Outlet<select value={selectedOutletId} onChange={event => setOutletId(event.target.value)}><option value="">Select outlet</option>{resellers.map(reseller => <option key={reseller.id} value={reseller.id}>{reseller.name}{reseller.area ? ` — ${reseller.area}` : ''}</option>)}</select></label>
        <label>Graph source<select value={sourceMode} onChange={event => setSourceChoice(event.target.value)}><option value="deliveries">Invoice deliveries</option><option value="closings">Daily closings (actual sold)</option></select></label>
        <label>Range<select value={rangeDays} onChange={event => setRangeDays(Number(event.target.value))}><option value="30">30 days</option><option value="90">90 days</option><option value="180">180 days</option></select></label>
        <label>Measure<select value={metric} onChange={event => setMetric(event.target.value)}><option value="sold_qty">{isDeliveryHistory ? 'Pieces delivered' : 'Pieces sold'}</option><option value="sales_amount">{isDeliveryHistory ? 'Invoiced amount (₱)' : 'Calculated sales (₱)'}</option></select></label>
      </div>
    </div>
    {error && <p className="outlet-performance-error" role="alert">{error}</p>}
    {isDeliveryHistory && <div className="outlet-performance-source-note"><strong>Delivery history from invoices.</strong> These figures show stock sent to the outlet and its invoiced amount. They do not show what customers actually bought. Choose “Daily closings (actual sold)” after recording physical closings below.</div>}
    {graphLoading ? <p>Loading outlet history…</p> : visibleRows.length === 0 ? <div className="outlet-performance-empty">{isDeliveryHistory ? 'No active delivery invoices for this outlet in the selected range. Try 180 days or another outlet.' : 'No daily closings in this range yet. Save the first physical closing below to start the sold graph.'}</div> : <>
      <div className="outlet-performance-chart">
        <h4>{isDeliveryHistory ? 'Daily deliveries' : 'Daily sold trend'} <small>{visibleRows.length} recorded day{visibleRows.length === 1 ? '' : 's'}</small></h4>
        <div className="outlet-performance-scroll">
          <svg viewBox="0 0 820 220" role="img" aria-label={`Daily ${metricLabel} trend`}>
            <line x1="40" y1="185" x2="780" y2="185" stroke="#d1d5db"/>
            <line x1="40" y1="40" x2="40" y2="185" stroke="#d1d5db"/>
            <text x="35" y="35" textAnchor="end" fontSize="11" fill="#64748b">{number(maxValue)}</text>
            <text x="35" y="188" textAnchor="end" fontSize="11" fill="#64748b">0</text>
            <text x="40" y="207" fontSize="11" fill="#64748b">{chartRows[0]?.business_date}</text>
            <text x="780" y="207" textAnchor="end" fontSize="11" fill="#64748b">{chartRows.at(-1)?.business_date}</text>
            <path d={path} fill="none" stroke="#ca1b1b" strokeWidth="3" strokeLinejoin="round"/>
            {chartRows.map(row => <g key={row.id} onClick={() => setSelectedId(row.id)} tabIndex="0" role="button" aria-label={`${row.business_date}: ${metric === 'sold_qty' ? `${number(row[metricKey])} ${metricLabel}` : peso(row[metricKey])}`} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setSelectedId(row.id) }}>
              <circle cx={xForDate(row.business_date)} cy={yForRow(row)} r={row.id === selected?.id ? 7 : 5} fill={row.id === selected?.id ? '#f3bd17' : '#ca1b1b'} stroke="white" strokeWidth="1"><title>{row.business_date}: {number(row[metricKey])} {metricLabel}{metric === 'sales_amount' ? ` (${peso(row[metricKey])})` : ''}</title></circle>
            </g>)}
          </svg>
        </div>
        <p>Tap a point to inspect that day. Lines break where no {isDeliveryHistory ? 'delivery invoice' : 'closing'} was recorded.</p>
      </div>
      <div className="outlet-performance-chart"><h4>Day of week averages</h4><div className="outlet-performance-weekdays">{weekdayRows.map(row => <div className="outlet-performance-weekday" key={row.name}><strong>{row.name.slice(0, 3)}</strong><div className="outlet-performance-bar-track"><div style={{ height:row.average === null ? 0 : `${Math.max(3, row.average / maxWeekday * 100)}%` }} /></div><span>{row.average === null ? 'No data' : metric === 'sold_qty' ? `${number(Math.round(row.average))} pcs` : peso(row.average)}</span><small>{row.count} day{row.count === 1 ? '' : 's'}</small></div>)}</div><p>{slowDays.length ? `${isDeliveryHistory ? 'Lower delivery weekdays' : 'Possible slow sales weekdays'}: ${slowDays.map(day => day.name).join(', ')}. Based on at least four recorded days and 20% below this outlet's overall daily average.` : `A weekday pattern is highlighted after at least four recorded ${isDeliveryHistory ? 'delivery' : 'closing'} days and an average 20% below this outlet's overall daily average.`}</p></div>
      <div className="outlet-performance-chart"><h4>Daily calendar</h4><div className="outlet-performance-heatmap">{calendarDays.map(({ date, closing }) => <button key={date} type="button" disabled={!closing} onClick={() => setSelectedId(closing.id)} title={closing ? `${date}: ${number(closing[metricKey])} ${metricLabel}` : `${date}: no ${isDeliveryHistory ? 'delivery invoice' : 'closing'} recorded`} style={{ background:closing ? `rgba(202,27,27,${0.12 + (Number(closing[metricKey]) || 0) / maxValue * 0.78})` : '#f1f2f4' }} className={selected?.id === closing?.id ? 'selected' : ''}><span>{date.slice(5)}</span></button>)}</div><p>Gray means no {isDeliveryHistory ? 'delivery invoice' : 'closing'} recorded. Missing dates are never counted as zero.</p></div>
      {selected && <div className="outlet-performance-chart"><h4>{resellers.find(item => item.id === selectedOutletId)?.name || 'Outlet'} · {selected.business_date}</h4>{isDeliveryHistory ? <><p><strong>{number(selected.delivered_qty)} pieces delivered</strong> · {peso(selected.invoiced_amount)} invoiced across {number(selected.invoice_count)} invoice{selected.invoice_count === 1 ? '' : 's'}. This is delivery activity, not customer sales.</p><div className="outlet-performance-scroll"><table><thead><tr><th>Product</th><th>Delivered</th><th>Item amount</th></tr></thead><tbody>{selected.items.map(item => <tr key={item.key}><td>{item.product_name}</td><td>{number(item.quantity)}</td><td>{peso(item.amount)}</td></tr>)}</tbody></table></div></> : <><p><strong>{number(selected.sold_qty)} pieces sold</strong> · {peso(selected.sales_amount)} calculated sales · {number(selected.wastage_qty)} wastage · recorded by {selected.recorded_by}</p>{selected.notes && <p>Notes: {selected.notes}</p>}<div className="outlet-performance-scroll"><table><thead><tr><th>Product</th><th>Beginning</th><th>Delivered</th><th>Added</th><th>Wastage</th><th>Ending</th><th>Sold</th><th>Price</th><th>Sales</th></tr></thead><tbody>{(selected.items || []).map((item, index) => <tr key={`${item.product_key}-${index}`}><td>{item.product_name}</td><td>{number(item.beginning)}</td><td>{number(item.delivered)}</td><td>{number(item.manualDelivered)}</td><td>{number(item.wastage)}</td><td>{number(item.ending)}</td><td>{number(item.sold)}</td><td>{peso(item.price)}</td><td>{peso(item.amount)}</td></tr>)}</tbody></table></div></>}</div>}
    </>}
    <div className="outlet-performance-chart outlet-performance-entry"><h4>Record daily closing</h4><p>Beginning + invoiced deliveries + manually added stock − wastage − ending count = pieces sold. Prices are captured with this record. This does not post sales or change balances.</p>{!selectedOutletId ? <p>Select one outlet above to record its closing.</p> : <><label>Business date <input type="date" value={closingDate} max={today} onChange={event => setClosingDate(event.target.value)} /></label>{formLoading ? <p>Loading stock and invoices…</p> : existing ? <p className="outlet-performance-saved">A closing is already saved for this outlet and date. Select its graph point to inspect it.</p> : <><p>{previousDate ? `Beginning counts are from the latest saved closing on ${previousDate}. Review them if stock changed since then.` : 'No prior daily closing was found. Enter beginning stock manually before saving.'} Invoiced deliveries are filled from this date’s active invoices.</p><label>Add product<select value="" onChange={event => addProduct(event.target.value)}><option value="">Choose another product…</option>{catalog.filter(product => !formRows.some(row => row.product_key === itemKey(product))).map(product => <option key={itemKey(product)} value={itemKey(product)}>{product.product_name || product.name}</option>)}</select></label>{formRows.length === 0 && <p className="outlet-performance-empty">No invoiced products or previous stock for this date. Choose a product above, enter its beginning or added stock, then enter the physical ending count.</p>}<div className="outlet-performance-scroll"><table><thead><tr><th>Product</th><th>Beginning</th><th>Invoiced</th><th>Added</th><th>Wastage</th><th>Ending count</th><th>Price</th><th>Sold</th><th>Sales</th></tr></thead><tbody>{formRows.map((row, index) => { let result; try { if (row.ending !== '') result = calculateOutletClosingLine(row) } catch { /* Invalid entries remain editable. */ } return <tr key={row.product_key}><td>{row.product_name}</td>{['beginning', 'delivered', 'manualDelivered', 'wastage', 'ending', 'price'].map(field => <td key={field}><input aria-label={`${row.product_name} ${field}`} type="number" min="0" step={field === 'price' ? '0.01' : '1'} value={row[field]} onChange={event => changeLine(index, field, event.target.value)} /></td>)}<td>{result ? number(result.sold) : '—'}</td><td>{result ? peso(result.amount) : '—'}</td></tr> })}</tbody></table></div><p><strong>Calculated: {number(totals.sold)} pieces · {peso(totals.sales)}</strong></p><label>Closing notes <textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Optional context for a slow day or stock variance" /></label><button type="button" className="outlet-performance-save" disabled={saving || !formRows.length} onClick={saveClosing}>{saving ? 'Saving…' : 'Save daily closing'}</button></>}</>}</div>
  </section>
}
