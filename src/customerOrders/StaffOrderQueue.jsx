import {useCallback, useEffect, useMemo, useState} from 'react'
import {createClient} from '@supabase/supabase-js'
import {callStaffOrdering} from './staffApi.mjs'
import {ORDER_QUEUE_VIEWS, ordersForView, finalStatusEvent} from './orderQueueViews.mjs'
import {downloadRetailInvoiceWord} from './retailInvoiceWord.mjs'
import {customerRetailInvoiceHtml} from '../../customer-ordering-preview/customer-invoice.mjs'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const money = value => `₱${Number(value || 0).toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2})}`
const when = value => value ? new Intl.DateTimeFormat('en-PH', {
  timeZone:'Asia/Manila', dateStyle:'medium', timeStyle:'short',
}).format(new Date(value)) : ''
const ACTIONS = {
  pending_confirmation:['accepted','declined','cancelled'],
  accepted:['preparing','cancelled'],
  preparing:['ready','cancelled'],
  ready:['out_for_delivery','completed','cancelled'],
  out_for_delivery:['completed'],
}
const ACTION_LABELS = {accepted:'Accept order',declined:'Decline request',cancelled:'Cancel order',
  preparing:'Start preparing',ready:'Mark ready',out_for_delivery:'Out for delivery'}

function Login({client, stagingPreview}) {
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')

  async function signIn(event) {
    event.preventDefault()
    if (!client || busy) return
    setBusy(true)
    setError('')
    try {
      const {error:signInError} = await client.auth.signInWithPassword({
        email:email.trim(), password,
      })
      if (signInError) throw signInError
      setPassword('')
    } catch (failure) {
      setError(failure.message || 'Sign-in failed. Check your staging test account.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="staff-login"><div className="staff-panel">
    <p className="staff-kicker">ROMA'S DONUTS</p><h1>Customer order queue</h1>
    {stagingPreview ? <>
      <p>Staging test sign-in. Use your staging test account.</p>
      <form onSubmit={signIn}>
        <label>Email<input type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="username" required /></label>
        <label>Password<input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password" required /></label>
        {error && <p className="staff-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy?'Signing in…':'Sign in to staging'}</button>
      </form>
    </> : <>
      <p>Sign in to Roma’s main business system to use the same account here.</p>
      <a href="/">Open main system sign-in</a>
    </>}
  </div></main>
}

export default function StaffOrderQueue({client: providedClient = null, serviceUrl = url, publishableKey = key, embedded = false, onOrdersChange, onPaymentRecorded, onForecastChanged}) {
  const client = useMemo(() => providedClient || (url && key ? createClient(url, key, {
    auth: {persistSession:true, autoRefreshToken:true},
  }) : null), [providedClient])
  const request = useCallback((action, payload) => callStaffOrdering(client, serviceUrl, publishableKey, action, payload), [client, serviceUrl, publishableKey])
  const [session,setSession] = useState(null)
  const [accessLevel,setAccessLevel] = useState('view')
  const [orders,setOrders] = useState([])
  const [queueView,setQueueView] = useState('pending')
  const [voidedStatus,setVoidedStatus] = useState('all')
  const [orderCounts,setOrderCounts] = useState({})
  const [retailInvoices,setRetailInvoices] = useState([])
  const [retailInvoiceCount,setRetailInvoiceCount] = useState(0)
  const [invoiceSearch,setInvoiceSearch] = useState('')
  const [invoicePreview,setInvoicePreview] = useState(null)
  const [pendingRetailInvoiceRemovals,setPendingRetailInvoiceRemovals] = useState([])
  const [canReviewRetailInvoices,setCanReviewRetailInvoices] = useState(false)
  const [removalNotes,setRemovalNotes] = useState({})
  const [orderingControl,setOrderingControl] = useState(null)
  const [orderingEvents,setOrderingEvents] = useState([])
  const [deliveryOrigins,setDeliveryOrigins] = useState([])
  const [automaticDeliveryQuoteAvailable,setAutomaticDeliveryQuoteAvailable] = useState(false)
  const [selectedId,setSelectedId] = useState('')
  const [detail,setDetail] = useState(null)
  const [detailRefresh,setDetailRefresh] = useState(0)
  const [message,setMessage] = useState('')
  const [statusNote,setStatusNote] = useState('')
  const [phoneCallConfirmed,setPhoneCallConfirmed] = useState(false)
  const [deliveryOrigin,setDeliveryOrigin] = useState('')
  const [deliveryRoute,setDeliveryRoute] = useState(null)
  const [roadKm,setRoadKm] = useState('')
  const [routeError,setRouteError] = useState('')
  const [routeLoading,setRouteLoading] = useState(false)
  const [paymentMethod,setPaymentMethod] = useState('Cash')
  const [paymentReference,setPaymentReference] = useState('')
  const [paymentConfirmed,setPaymentConfirmed] = useState(false)
  const [refundMethod,setRefundMethod] = useState('Cash')
  const [refundReference,setRefundReference] = useState('')
  const [refundReason,setRefundReason] = useState('')
  const [refundConfirmed,setRefundConfirmed] = useState(false)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [loading,setLoading] = useState(false)
  const visibleOrders = useMemo(()=>ordersForView(orders,queueView,voidedStatus),[orders,queueView,voidedStatus])
  const visibleInvoices = useMemo(()=>retailInvoices.filter(invoice =>
    `${invoice.invoice_number} ${invoice.customer_name}`.toLowerCase().includes(invoiceSearch.trim().toLowerCase())),[retailInvoices,invoiceSearch])
  const selected = useMemo(()=>visibleOrders.find(order=>order.id===selectedId),[visibleOrders,selectedId])
  const selectedDetail = selected && detail?.id===selected.id ? detail : null
  const routeOrderId = selectedDetail?.id
  const routeEligible = selectedDetail?.fulfillment_type==='delivery' && selectedDetail?.status==='pending_confirmation'
  const voidEvent = finalStatusEvent(selectedDetail)

  function changeQueueView(view, status = 'all') {
    setQueueView(view)
    setVoidedStatus(status)
    setSelectedId('')
    setDetail(null)
  }

  function closeSelectedOrder() {
    setSelectedId('')
    setDetail(null)
  }

  useEffect(()=>{
    if (!client) return undefined
    client.auth.getSession().then(({data})=>setSession(data.session))
    const {data:{subscription}} = client.auth.onAuthStateChange((_event,next)=>setSession(next))
    return ()=>subscription.unsubscribe()
  },[client])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await request('staff-list')
      setOrders(result.orders)
      setOrderCounts(result.orderCounts || {})
      setRetailInvoices(result.retailInvoices || [])
      setRetailInvoiceCount(result.retailInvoiceCount || 0)
      setInvoicePreview(null)
      setPendingRetailInvoiceRemovals(result.pendingRetailInvoiceRemovals || [])
      setCanReviewRetailInvoices(result.canReviewRetailInvoices === true)
      onOrdersChange?.(result.orders)
      setAccessLevel(result.accessLevel)
      setOrderingControl(result.orderingControl)
      setOrderingEvents(result.orderingEvents || [])
      setDeliveryOrigins(result.deliveryOrigins || [])
      setAutomaticDeliveryQuoteAvailable(result.automaticDeliveryQuoteAvailable===true)
      setSelectedId(current=>{
        const nextOrders = ordersForView(result.orders,queueView,voidedStatus)
        return nextOrders.some(order=>order.id===current) ? current : ''
      })
      setDetail(null)
      setDetailRefresh(current=>current+1)
      setError('')
    } catch (failure) { setError(failure.message) }
    finally { setLoading(false) }
  },[request,onOrdersChange,queueView,voidedStatus])

  useEffect(()=>{
    if(!session)return undefined
    let active=true
    request('staff-list').then(result=>{
      if(active){setAccessLevel(result.accessLevel);setOrders(result.orders);setOrderCounts(result.orderCounts || {});setRetailInvoices(result.retailInvoices || []);setRetailInvoiceCount(result.retailInvoiceCount || 0);setPendingRetailInvoiceRemovals(result.pendingRetailInvoiceRemovals || []);setCanReviewRetailInvoices(result.canReviewRetailInvoices === true);setOrderingControl(result.orderingControl);setOrderingEvents(result.orderingEvents || []);setDeliveryOrigins(result.deliveryOrigins || []);setAutomaticDeliveryQuoteAvailable(result.automaticDeliveryQuoteAvailable===true);onOrdersChange?.(result.orders)}
    }).catch(failure=>{if(active)setError(failure.message)})
    return ()=>{active=false}
  },[session,request,onOrdersChange])
  useEffect(()=>{
    if (!session || !selectedId) return undefined
    let active = true
    request('staff-get',{orderId:selectedId}).then(result=>{
      if(active){setDetail(result.order);setError('')}
    }).catch(failure=>{if(active)setError(failure.message)})
    return ()=>{active=false}
  },[session,selectedId,detailRefresh,request])

  // Keep the selected conversation current without resetting the staff member's draft.
  useEffect(()=>{
    if (!session || !selectedId) return undefined
    let active = true
    let inFlight = false
    const updateConversation = async () => {
      if (!active || inFlight || document.visibilityState === 'hidden') return
      inFlight = true
      try {
        const result = await request('staff-get',{orderId:selectedId})
        if (active) setDetail(result.order)
      } catch {
        // The normal fetch and Refresh button surface errors; a background
        // retry should not replace an existing conversation with an error.
      } finally { inFlight = false }
    }
    const timer = window.setInterval(updateConversation, 8000)
    document.addEventListener('visibilitychange', updateConversation)
    return ()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange', updateConversation)}
  },[session,selectedId,request])

  // Pick up newly submitted orders and status changes while this page stays open.
  useEffect(()=>{
    if (!session) return undefined
    let active = true
    let inFlight = false
    const updateQueue = async () => {
      if (!active || inFlight || document.visibilityState === 'hidden') return
      inFlight = true
      try {
        const result = await request('staff-list')
        if (!active) return
        setOrders(result.orders)
        setOrderCounts(result.orderCounts || {})
        setRetailInvoices(result.retailInvoices || [])
        setRetailInvoiceCount(result.retailInvoiceCount || 0)
        setInvoicePreview(current => current && result.retailInvoices?.some(invoice=>invoice.id===current.id) ? current : null)
        setPendingRetailInvoiceRemovals(result.pendingRetailInvoiceRemovals || [])
        onOrdersChange?.(result.orders)
        setOrderingControl(result.orderingControl)
      } catch {
        // Preserve the last good queue until the next poll or manual Refresh.
      } finally { inFlight = false }
    }
    const timer = window.setInterval(updateQueue, 20000)
    document.addEventListener('visibilitychange', updateQueue)
    return ()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange', updateQueue)}
  },[session,request,onOrdersChange])

  useEffect(()=>{
    if (!routeEligible || !routeOrderId || !deliveryOrigin || accessLevel!=='full'
      || !automaticDeliveryQuoteAvailable) {
      return undefined
    }
    let active=true
    request('staff-delivery-route',{orderId:routeOrderId,originLocation:deliveryOrigin})
      .then(result=>{if(active)setDeliveryRoute({...result,origin:deliveryOrigin})})
      .catch(failure=>{if(active)setRouteError(failure.message)})
      .finally(()=>{if(active)setRouteLoading(false)})
    return ()=>{active=false}
  },[routeOrderId,routeEligible,deliveryOrigin,accessLevel,automaticDeliveryQuoteAvailable,request])

  async function updateStatus(status) {
    if (!detail || busy) return
    setBusy(true)
    try {
      await request('staff-status',{
        orderId:detail.id,expectedStatus:detail.status,status,note:statusNote,
      })
      onForecastChanged?.()
      setStatusNote('')
      await refresh()
      const result = await request('staff-get',{orderId:detail.id})
      setDetail(result.order)
    } catch(failure){setError(failure.message)}
    finally{setBusy(false)}
  }

  async function printRetailInvoice(invoice = detail?.retailInvoice) {
    if (!invoice || busy) return
    setBusy(true);setError('')
    try {
      const result = await request('staff-get',{orderId:invoice.order_id})
      const current = result.order?.retailInvoice
      if (current?.id !== invoice.id || current.status !== 'active')
        throw new Error('This invoice is no longer active. Refresh the list.')
      await downloadRetailInvoiceWord(current)
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  async function openRetailInvoice(invoice) {
    if (busy) return
    setBusy(true);setError('');setInvoicePreview(null)
    try {
      const result = await request('staff-get',{orderId:invoice.order_id})
      if (result.order?.retailInvoice?.id !== invoice.id || result.order.retailInvoice.status !== 'active')
        throw new Error('This invoice is no longer active. Refresh the list.')
      const current = result.order.retailInvoice
      setInvoicePreview({...current, previewHtml:customerRetailInvoiceHtml(current).replace('</style>', '.actions{display:none!important}</style>')})
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  async function reviewRetailInvoiceRemoval(removal,decision) {
    if (!canReviewRetailInvoices || busy) return
    const note = String(removalNotes[removal.id] || '').trim()
    if (decision === 'reject' && note.length < 3) {
      setError('Enter a reason before rejecting the removal request.')
      return
    }
    if (!window.confirm(`${decision === 'approve' ? 'Approve' : 'Reject'} removal of retail invoice ${removal.invoice_number}? A clean unpaid invoice is deleted after approval; one with payment history is voided and retained.`)) return
    setBusy(true);setError('')
    try {
      await request('staff-invoice-review',{requestId:removal.id,decision,note})
      await refresh()
      if (selectedId === removal.order_id) {
        const result = await request('staff-get',{orderId:removal.order_id})
        setDetail(result.order)
      }
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  async function confirmPhoneByCall(event) {
    event.preventDefault()
    if (!detail || busy || !phoneCallConfirmed || detail.status!=='pending_confirmation') return
    setBusy(true);setError('')
    try {
      await request('staff-phone-confirm',{orderId:detail.id})
      setPhoneCallConfirmed(false)
      await refresh()
      const result = await request('staff-get',{orderId:detail.id})
      setDetail(result.order)
    } catch(failure){setError(failure.message)}
    finally{setBusy(false)}
  }

  async function quoteDelivery(event) {
    event.preventDefault()
    if (!detail || busy || detail.fulfillment_type!=='delivery' || detail.status!=='pending_confirmation') return
    setBusy(true);setError('')
    try {
      await request('staff-delivery-quote', {
        orderId:detail.id,originLocation:deliveryOrigin,
        ...(!automaticDeliveryQuoteAvailable?{roadKm:Number(roadKm)}:{}),
      })
      setPhoneCallConfirmed(false)
      await refresh()
      const result = await request('staff-get',{orderId:detail.id})
      setDetail(result.order)
    } catch(failure){setError(failure.message)}
    finally{setBusy(false)}
  }

  async function sendMessage(event) {
    event.preventDefault()
    if (!detail || !message.trim() || busy) return
    setBusy(true)
    try {
      await request('staff-message',{orderId:detail.id,message:message.trim()})
      setMessage('')
      const result = await request('staff-get',{orderId:detail.id})
      setDetail(result.order)
    } catch(failure){setError(failure.message)}
    finally{setBusy(false)}
  }

  async function recordPayment(event) {
    event.preventDefault()
    if (!detail || busy || !paymentConfirmed) return
    setBusy(true);setError('')
    try {
      await request('staff-pay',{
        orderId:detail.id,paymentMethod,
        referenceNumber:paymentMethod==='Cash'?'':paymentReference.trim(),
      })
      onPaymentRecorded?.()
      setPaymentReference('');setPaymentConfirmed(false)
      await refresh()
    } catch(failure){setError(failure.message)}
    finally{setBusy(false)}
  }

  async function recordRefund(event) {
    event.preventDefault()
    if (!detail || busy || !refundConfirmed || refundReason.trim().length < 10) return
    setBusy(true);setError('')
    try {
      await request('staff-refund',{
        orderId:detail.id,refundMethod,reason:refundReason.trim(),
        referenceNumber:refundMethod==='Cash'?'':refundReference.trim(),
      })
      onForecastChanged?.()
      setRefundReference('');setRefundReason('');setRefundConfirmed(false)
      await refresh()
    } catch(failure){setError(failure.message)}
    finally{setBusy(false)}
  }

  async function toggleOrdering() {
    if (accessLevel !== 'full' || !orderingControl || busy || loading) return
    const enabled = !orderingControl.configuredEnabled
    if (enabled && !orderingControl.canOpen) return
    setBusy(true);setError('')
    try {
      await request('staff-ordering-set', {enabled,expectedVersion:orderingControl.version})
      await refresh()
    } catch(failure) {await refresh();setError(failure.message)}
    finally {setBusy(false)}
  }

  if (!client) return <main className="staff-login"><div className="staff-panel">
    <h1>Customer orders are not configured</h1>
    <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using this staff page.</p>
  </div></main>
  if (!session) return <Login client={client} stagingPreview={!embedded && import.meta.env.DEV && import.meta.env.VITE_STAGING_STAFF_LOGIN === 'true'} />

  return <main className={`staff-app${embedded?' staff-embedded':''}`}>
    <header><div><p className="staff-kicker">ROMA'S DONUTS · STAFF</p><h1>Customer orders</h1><p>{accessLevel==='full'?'Full access':'View only'}</p></div>
      <div className="staff-header-actions"><button onClick={()=>void refresh()} disabled={loading}>Refresh</button>
        {!embedded && <><a href="/">Main system</a><button onClick={()=>void client.auth.signOut()}>Sign out of main system</button></>}</div></header>
    {orderingControl && <section className="staff-ordering-control" aria-label="Customer ordering availability">
      <div><strong role="status">Customer ordering is {orderingControl.enabled?'OPEN':'CLOSED'}</strong>
        <p>{orderingControl.canOpen?'New customer requests follow the published pickup hours and 5 PM next-day cutoff. Delivery requests require a staff quote and customer confirmation.':'Opening is temporarily locked by the server.'}</p>
        {orderingEvents.length > 0 && <details><summary>Ordering change history</summary><ol>
          {orderingEvents.map(event=><li key={event.id}>{event.actor_name} {event.new_enabled?'opened':'closed'} ordering · {when(event.created_at)}</li>)}
        </ol></details>}
      </div>
      {accessLevel==='full' && <button type="button" onClick={()=>void toggleOrdering()}
        disabled={busy||loading||(!orderingControl.canOpen&&!orderingControl.configuredEnabled)}
        aria-label={orderingControl.configuredEnabled?'Close customer ordering':'Open customer ordering'}>
        {busy?'Saving…':orderingControl.configuredEnabled?'Close ordering':'Open ordering'}
      </button>}
    </section>}
    {error && <p role="alert" className="staff-error">{error}</p>}
    <section className="staff-panel staff-retail-invoices" aria-label="Retail customer invoices">
      <h2>Retail customer invoices <span>({retailInvoiceCount})</span></h2>
      <p className="staff-hint">Invoices for accepted online orders are kept here, separate from reseller invoices and payment receipts.</p>
      <label>Find invoice by number or customer
        <input type="search" value={invoiceSearch} onChange={event=>setInvoiceSearch(event.target.value)} placeholder="Search recent retail invoices" />
      </label>
      {retailInvoiceCount > retailInvoices.length && <p className="staff-hint">Showing the latest {retailInvoices.length} invoices.</p>}
      <div className="staff-retail-invoice-list">
        {visibleInvoices.length ? visibleInvoices.map(invoice=><div className="staff-retail-invoice-row" key={invoice.id}>
          <div className="staff-retail-invoice-summary"><strong>{invoice.invoice_number}</strong><span>{invoice.customer_name}</span><span>{when(invoice.scheduled_at)}</span><strong>{money(invoice.total)}</strong></div>
          <div className="staff-retail-invoice-actions">
            <button type="button" disabled={busy} onClick={()=>void openRetailInvoice(invoice)}>View invoice</button>
            <button type="button" disabled={busy} onClick={()=>void printRetailInvoice(invoice)}>PRINT invoice</button>
          </div>
        </div>) : <p className="staff-hint">{invoiceSearch?'No matching invoice in the recent list.':'No active retail invoices yet.'}</p>}
      </div>
      {invoicePreview && <div className="staff-invoice-overlay" role="presentation" onClick={()=>setInvoicePreview(null)}>
        <div className="staff-invoice-dialog" role="dialog" aria-modal="true" aria-label={`Retail invoice ${invoicePreview.invoice_number}`} onClick={event=>event.stopPropagation()}>
          <div className="staff-invoice-dialog-header"><strong>{invoicePreview.invoice_number}</strong><div>
            <button type="button" disabled={busy} onClick={()=>void printRetailInvoice(invoicePreview)}>PRINT invoice</button>
            <button type="button" onClick={()=>setInvoicePreview(null)}>Close</button>
          </div></div>
          <iframe title={`Retail invoice ${invoicePreview.invoice_number}`} srcDoc={invoicePreview.previewHtml} sandbox="" />
        </div>
      </div>}
    </section>
    {canReviewRetailInvoices && pendingRetailInvoiceRemovals.length > 0 && <section className="staff-panel" aria-label="Retail invoice removal approvals">
      <h2>Retail invoices awaiting owner approval ({pendingRetailInvoiceRemovals.length})</h2>
      <p className="staff-hint">Cancelled orders are already excluded from the production forecast. Approve removal to delete a clean unpaid invoice or void one with payment history. The invoice snapshot remains in the audit request.</p>
      {pendingRetailInvoiceRemovals.map(item=><div className="staff-row" key={item.id}>
        <div><strong>{item.invoice_number}</strong> · {item.invoice_snapshot?.customer_name} · {money(item.invoice_snapshot?.total)}
          <br /><small>Requested {when(item.requested_at)}</small>
          <label>Review note<input value={removalNotes[item.id] || ''} onChange={event=>setRemovalNotes(notes=>({...notes,[item.id]:event.target.value}))} maxLength={500} /></label>
        </div>
        <div className="staff-actions"><button disabled={busy} onClick={()=>void reviewRetailInvoiceRemoval(item,'approve')}>Approve removal</button>
          <button disabled={busy} onClick={()=>void reviewRetailInvoiceRemoval(item,'reject')}>Reject</button></div>
      </div>)}
    </section>}
    <div className="staff-layout">
      <section className="staff-panel staff-list" aria-label="Order queue">
        <h2>Orders {loading && <small>Refreshing…</small>}</h2>
        <nav className="staff-queue-tabs" aria-label="Order status views">
          {ORDER_QUEUE_VIEWS.map(view=><button type="button" key={view.id} className={queueView===view.id?'active':''} aria-current={queueView===view.id?'page':undefined}
            onClick={()=>changeQueueView(view.id)}>{view.label} <span>{orderCounts[view.id] ?? ordersForView(orders,view.id).length}</span></button>)}
        </nav>
        {queueView==='voided' && <div className="staff-voided-tabs" role="group" aria-label="Voided order type">
          {['all','cancelled','declined'].map(status=><button type="button" key={status} className={voidedStatus===status?'active':''} aria-pressed={voidedStatus===status}
            onClick={()=>changeQueueView('voided',status)}>{status==='all'?'All voided':status==='cancelled'?'Cancelled':'Declined'}</button>)}
        </div>}
        {visibleOrders.length===0 && <p>No orders in this view.</p>}
        {queueView!=='voided' && orderCounts[queueView] > visibleOrders.length && <p className="staff-hint">Showing the latest {visibleOrders.length} of {orderCounts[queueView]} orders in this view.</p>}
        {queueView==='voided' && (orderCounts[voidedStatus] ?? orderCounts.voided) > visibleOrders.length && <p className="staff-hint">Showing the latest {visibleOrders.length} of {orderCounts[voidedStatus] ?? orderCounts.voided} voided orders.</p>}
        {visibleOrders.map(order=><button className={selectedId===order.id?'selected':''} key={order.id} onClick={()=>{setDetail(null);setPhoneCallConfirmed(false);setDeliveryOrigin('');setDeliveryRoute(null);setRoadKm('');setRouteError('');setPaymentConfirmed(false);setPaymentReference('');setRefundConfirmed(false);setRefundReference('');setRefundReason('');setSelectedId(order.id);setDetailRefresh(current=>current+1)}}>
          <strong>{order.order_code}</strong><span>{order.status.replaceAll('_',' ')}</span>
          <small>{order.customer_name} · {when(order.scheduled_at)}</small>
          <small>{order.fulfillment_type} · {order.fulfillment_type==='delivery'&&!order.delivery_quoted_at?'Fee pending':money(order.total)}</small>
        </button>)}
      </section>
      {selectedId && <div className="staff-order-detail-overlay" role="presentation" onClick={closeSelectedOrder}>
      <section className="staff-panel staff-detail" role="dialog" aria-modal="true" aria-label="Selected order" onClick={event=>event.stopPropagation()}>
        <button type="button" className="staff-detail-close" onClick={closeSelectedOrder}>Close order</button>
        {!selectedDetail ? <p>{selected?'Loading order…':'Select an order.'}</p> : <>
          <div className="staff-title"><h2>{selectedDetail.order_code}</h2><span>{selectedDetail.status.replaceAll('_',' ')}</span></div>
          {selectedDetail.retailInvoice?.status === 'active' && <button type="button" className="staff-invoice-shortcut" disabled={busy} onClick={()=>void printRetailInvoice(selectedDetail.retailInvoice)}>PRINT retail invoice {selectedDetail.retailInvoice.invoice_number}</button>}
          {voidEvent && <p className="staff-void-audit" role="status"><strong>{selectedDetail.status==='cancelled'?'Cancelled':'Declined'} by {voidEvent.actor_name || (voidEvent.actor==='customer'?'Customer':'System')}</strong> on {when(voidEvent.created_at)}{voidEvent.note?` · ${voidEvent.note}`:''}. Full activity appears in Order history below.</p>}
          <p><strong>{detail.customer_name}</strong> · {detail.customer_phone}</p>
          {detail.fulfillment_type==='delivery' && <>
            <p><strong>Delivery destination:</strong> {detail.delivery_address}, {detail.delivery_municipality}</p>
            <p><strong>Landmark:</strong> {detail.delivery_landmark}</p>
            <p><a href={`https://www.openstreetmap.org/?mlat=${Number(detail.delivery_latitude)}&mlon=${Number(detail.delivery_longitude)}#map=16/${Number(detail.delivery_latitude)}/${Number(detail.delivery_longitude)}`} target="_blank" rel="noreferrer">View customer map pin ↗</a></p>
            {detail.delivery_quoted_at
              ? <p className="staff-hint" role="status">Delivery quote: {detail.distance_km} road km from {detail.delivery_origin_location}; fee {money(detail.delivery_fee)}. Confirm the full {money(detail.total)} with the customer before accepting.</p>
              : <p className="staff-hint" role="status">Road distance and delivery fee have not been confirmed. This request cannot be accepted yet.</p>}
            {detail.status==='pending_confirmation' && accessLevel==='full' && <form className="staff-payment" onSubmit={quoteDelivery}>
              <h3>Set delivery quote</h3>
              <p className="staff-hint">Verify the destination pin, then select the actual dispatch location. {automaticDeliveryQuoteAvailable?'Driving distance and the delivery fee are calculated automatically.':'Measure the road distance before entering it below.'} Rate: ₱80 for the first 3 km plus ₱10 for each additional started km. Saving a new quote clears any earlier phone confirmation.</p>
              <label>Dispatch location<select value={deliveryOrigin} onChange={event=>{setDeliveryRoute(null);setRouteError('');setRouteLoading(Boolean(event.target.value&&automaticDeliveryQuoteAvailable));setDeliveryOrigin(event.target.value)}} required>
                <option value="">Select location</option>
                {deliveryOrigins.map(origin=><option key={origin.name} value={origin.name}>{origin.name}</option>)}
              </select></label>
              {automaticDeliveryQuoteAvailable ? <>
                {routeLoading && <p role="status">Calculating driving route and delivery fee…</p>}
                {routeError && <p role="alert" className="staff-error">{routeError}</p>}
                {deliveryRoute?.origin===deliveryOrigin && <p role="status"><strong>{deliveryRoute.roadKm} road km · {money(deliveryRoute.deliveryFee)} delivery fee · {money(deliveryRoute.total)} order total</strong><br /><small>Road route by HeiGIT openrouteservice using OpenStreetMap data. Review this quote before saving; the route is checked again when saved.</small></p>}
              </> : <label>Verified road distance (km)<input type="number" min="0" max="100" step="0.001" value={roadKm} onChange={event=>setRoadKm(event.target.value)} required /></label>}
              <button disabled={busy||!deliveryOrigin||(automaticDeliveryQuoteAvailable?(routeLoading||!deliveryRoute||deliveryRoute.origin!==deliveryOrigin):(roadKm===''||Number(roadKm)<0||Number(roadKm)>100))}>{busy?'Saving…':'Save delivery quote'}</button>
            </form>}
          </>}
          {detail.phone_verified_at
            ? <p className="staff-hint" role="status">Phone confirmed by staff call on {when(detail.phone_verified_at)}.</p>
            : detail.status==='pending_confirmation' && accessLevel==='full'
              ? <form className="staff-payment" onSubmit={confirmPhoneByCall}>
                <h3>Confirm customer by phone</h3>
                <p className="staff-hint">Call {detail.customer_phone} and confirm the customer’s name, order, {detail.fulfillment_type==='delivery'?'delivery address, requested time, and full quoted total':'pickup location, and requested time'} before accepting.</p>
                <label className="staff-payment-confirm"><input type="checkbox" checked={phoneCallConfirmed} onChange={event=>setPhoneCallConfirmed(event.target.checked)} /> I spoke with the customer at this number and they agreed to the order details{detail.fulfillment_type==='delivery'?' and full delivery charge':''}.</label>
                <button disabled={busy||!phoneCallConfirmed||(detail.fulfillment_type==='delivery'&&!detail.delivery_quoted_at)}>{busy?'Saving…':'Record phone confirmation'}</button>
              </form>
              : <p className="staff-hint">Phone confirmation was not recorded for this order.</p>}
          <p>{when(detail.scheduled_at)} · {detail.fulfillment_type}</p>
          <p>{detail.fulfillment_type==='pickup'
            ? `${detail.pickup_location} — ${detail.pickup_address_snapshot}`
            : `${detail.delivery_address}, ${detail.delivery_municipality}`}</p>
          {detail.notes && <p><strong>Notes:</strong> {detail.notes}</p>}
          <h3>Items</h3>
          {detail.items.map(item=><div className="staff-row" key={item.product_id}>
            <span>{item.quantity} × {item.product_name}</span><strong>{money(item.line_total)}</strong>
          </div>)}
          <div className="staff-row"><span>Subtotal</span><strong>{money(detail.subtotal)}</strong></div>
          <div className="staff-row"><span>Delivery</span><strong>{detail.fulfillment_type==='delivery'&&!detail.delivery_quoted_at?'Pending quote':money(detail.delivery_fee)}</strong></div>
          <div className="staff-row staff-total"><span>Total · {detail.payment_status}</span><strong>{detail.fulfillment_type==='delivery'&&!detail.delivery_quoted_at?'Pending quote':money(detail.total)}</strong></div>
          {detail.paid_at && <p className="staff-hint">Payment recorded {when(detail.paid_at)}. This order is linked to one separate online sale.</p>}
          {detail.refunded_at && <p className="staff-hint">Full refund recorded {when(detail.refunded_at)}. The original sale remains in the ledger, with a separate reversing entry{detail.receipt?.refund?.id? ` (${detail.receipt.refund.id})` : ''}.</p>}
          {detail.retailInvoice?.status === 'active' && <section className="staff-payment" aria-label="Retail order invoice">
            <h3>Retail order invoice {detail.retailInvoice.invoice_number}</h3>
            <p className="staff-hint">Issued at retail prices when the verified order was accepted. This invoice is separate from reseller invoices and the payment receipt.</p>
            <button type="button" disabled={busy} onClick={()=>void printRetailInvoice()}>PRINT invoice · Download Word</button>
          </section>}
          {detail.retailInvoice?.status === 'pending_removal' && <p className="staff-hint" role="status">Retail invoice {detail.retailInvoice.invoice_number} awaits owner approval for removal. This cancelled order is excluded from the forecast.</p>}
          {detail.retailInvoiceRemoval?.status === 'approved' && <p className="staff-hint" role="status">Retail invoice {detail.retailInvoiceRemoval.invoice_number} was {detail.retailInvoiceRemoval.result_action} after owner approval on {when(detail.retailInvoiceRemoval.reviewed_at)}.</p>}
          {accessLevel==='full' && <><h3>Review</h3>
          <label>Reason or review note<input value={statusNote} onChange={event=>setStatusNote(event.target.value)} maxLength={500} /></label>
          <div className="staff-actions">{(ACTIONS[detail.status]||[])
            .filter(action=>(action!=='out_for_delivery'||detail.fulfillment_type==='delivery')
              && (action!=='completed'||(detail.fulfillment_type==='pickup'&&detail.status==='ready')||(detail.fulfillment_type==='delivery'&&detail.status==='out_for_delivery'))
              && (action!=='cancelled'||detail.payment_status!=='paid'))
            .map(action=><button key={action} disabled={busy||(action==='accepted'&&(!detail.phone_verified_at||(detail.fulfillment_type==='delivery'&&!detail.delivery_quoted_at)))} onClick={()=>void updateStatus(action)}>{action==='completed'?(detail.fulfillment_type==='delivery'?'Mark delivered':'Mark picked up'):(ACTION_LABELS[action] || action.replaceAll('_',' '))}</button>)}</div>
          {detail.payment_status==='unpaid' && ['accepted','preparing','ready','out_for_delivery','completed'].includes(detail.status) && <form className="staff-payment" onSubmit={recordPayment}>
            <h3>Confirm payment and record online sale</h3>
            <p className="staff-hint">Record this once, only after receiving and checking the full {money(detail.total)} payment. This automatically adds one separate online sale to Daily Sales, apart from the outlet POS.</p>
            <label>Payment method<select value={paymentMethod} onChange={event=>{setPaymentMethod(event.target.value);setPaymentReference('');setPaymentConfirmed(false)}}>
              {['Cash','GCash','Maya','Bank Transfer','QR PH'].map(method=><option key={method}>{method}</option>)}
            </select></label>
            {paymentMethod!=='Cash' && <label>Payment reference<input value={paymentReference} onChange={event=>setPaymentReference(event.target.value)} maxLength={120} required /></label>}
            <label className="staff-payment-confirm"><input type="checkbox" checked={paymentConfirmed} onChange={event=>setPaymentConfirmed(event.target.checked)} /> I verified receipt of the full payment.</label>
            <button disabled={busy||!paymentConfirmed||paymentMethod!=='Cash'&&!paymentReference.trim()}>{busy?'Recording…':'Record paid online sale'}</button>
          </form>}
          {detail.payment_status==='paid' && ['accepted','preparing','ready','out_for_delivery','completed'].includes(detail.status) && <form className="staff-payment" onSubmit={recordRefund}>
            <h3>Record full refund</h3>
            <p className="staff-hint">Use this only after returning the full {money(detail.total)} to the customer. This page records the reversal; it does not send money. Unfulfilled orders will be cancelled and removed from the production forecast. Completed orders keep their fulfillment history.</p>
            <label>Refund method<select value={refundMethod} onChange={event=>{setRefundMethod(event.target.value);setRefundReference('');setRefundConfirmed(false)}}>
              {['Cash','GCash','Maya','Bank Transfer','QR PH'].map(method=><option key={method}>{method}</option>)}
            </select></label>
            {refundMethod!=='Cash' && <label>Refund transaction reference<input value={refundReference} onChange={event=>setRefundReference(event.target.value)} maxLength={120} required /></label>}
            <label>Refund reason<input value={refundReason} onChange={event=>setRefundReason(event.target.value)} minLength={10} maxLength={500} required /></label>
            <label className="staff-payment-confirm"><input type="checkbox" checked={refundConfirmed} onChange={event=>setRefundConfirmed(event.target.checked)} /> I verified that the full refund was issued to the customer.</label>
            <button disabled={busy||!refundConfirmed||refundReason.trim().length<10||refundMethod!=='Cash'&&!refundReference.trim()}>{busy?'Recording…':'Record full refund and reversal'}</button>
          </form>}</>}
          <h3>Order history</h3>
          <div className="staff-messages" aria-label="Order audit trail">{(detail.events||[]).map(event=><div key={event.id}>
            <strong>{event.actor_name || (event.actor==='customer'?'Customer':'System')}</strong> <small>{when(event.created_at)}</small>
            <p>{event.old_status && event.old_status!==event.new_status ? `${event.old_status.replaceAll('_',' ')} → ` : ''}{event.new_status.replaceAll('_',' ')}{event.note ? ` · ${event.note}` : ''}</p>
          </div>)}</div>
          <h3>Order chat</h3>
          <div className="staff-messages">{detail.messages.map(item=><div key={item.id}>
            <strong>{item.sender==='staff'?'Roma’s team':'Customer'}</strong> <small>{when(item.created_at)}</small>
            <p>{item.body}</p>
          </div>)}</div>
          {accessLevel==='full' && <form className="staff-chat" onSubmit={sendMessage}><input aria-label="Reply to customer" value={message} onChange={event=>setMessage(event.target.value)} maxLength={500} required />
            <button disabled={busy}>Send</button></form>}
        </>}
      </section>
      </div>}
    </div>
  </main>
}
