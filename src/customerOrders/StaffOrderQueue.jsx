import {useCallback, useEffect, useMemo, useState} from 'react'
import {createClient} from '@supabase/supabase-js'
import {callStaffOrdering} from './staffApi.mjs'
import {ORDER_QUEUE_VIEWS, ordersForView, finalStatusEvent} from './orderQueueViews.mjs'

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
  ready:['out_for_delivery','cancelled'],
}

function Login() {
  return <main className="staff-login"><div className="staff-panel">
    <p className="staff-kicker">ROMA'S DONUTS</p><h1>Customer order queue</h1>
    <p>Sign in to Roma’s main business system to use the same account here.</p>
    <a href="/">Open main system sign-in</a>
  </div></main>
}

export default function StaffOrderQueue({client: providedClient = null, serviceUrl = url, publishableKey = key, embedded = false, onOrdersChange}) {
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
  const [orderingControl,setOrderingControl] = useState(null)
  const [orderingEvents,setOrderingEvents] = useState([])
  const [deliveryOrigins,setDeliveryOrigins] = useState([])
  const [selectedId,setSelectedId] = useState('')
  const [detail,setDetail] = useState(null)
  const [detailRefresh,setDetailRefresh] = useState(0)
  const [message,setMessage] = useState('')
  const [statusNote,setStatusNote] = useState('')
  const [phoneCallConfirmed,setPhoneCallConfirmed] = useState(false)
  const [deliveryOrigin,setDeliveryOrigin] = useState('')
  const [roadKm,setRoadKm] = useState('')
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
  const selected = useMemo(()=>visibleOrders.find(order=>order.id===selectedId),[visibleOrders,selectedId])
  const selectedDetail = selected && detail?.id===selected.id ? detail : null
  const voidEvent = finalStatusEvent(selectedDetail)

  function changeQueueView(view, status = 'all') {
    const nextOrders = ordersForView(orders,view,status)
    setQueueView(view)
    setVoidedStatus(status)
    setSelectedId(nextOrders[0]?.id || '')
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
      onOrdersChange?.(result.orders)
      setAccessLevel(result.accessLevel)
      setOrderingControl(result.orderingControl)
      setOrderingEvents(result.orderingEvents || [])
      setDeliveryOrigins(result.deliveryOrigins || [])
      setSelectedId(current=>{
        const nextOrders = ordersForView(result.orders,queueView,voidedStatus)
        return nextOrders.some(order=>order.id===current) ? current : nextOrders[0]?.id || ''
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
      if(active){setAccessLevel(result.accessLevel);setOrders(result.orders);setOrderCounts(result.orderCounts || {});setOrderingControl(result.orderingControl);setOrderingEvents(result.orderingEvents || []);setDeliveryOrigins(result.deliveryOrigins || []);onOrdersChange?.(result.orders);setSelectedId(current=>{
        const nextOrders = ordersForView(result.orders,'pending')
        return nextOrders.some(order=>order.id===current) ? current : nextOrders[0]?.id || ''
      })}
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

  async function updateStatus(status) {
    if (!detail || busy) return
    setBusy(true)
    try {
      await request('staff-status',{
        orderId:detail.id,expectedStatus:detail.status,status,note:statusNote,
      })
      setStatusNote('')
      await refresh()
      const result = await request('staff-get',{orderId:detail.id})
      setDetail(result.order)
    } catch(failure){setError(failure.message)}
    finally{setBusy(false)}
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
        orderId:detail.id,originLocation:deliveryOrigin,roadKm:Number(roadKm),
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
  if (!session) return <Login />

  return <main className={`staff-app${embedded?' staff-embedded':''}`}>
    <header><div><p className="staff-kicker">ROMA'S DONUTS · STAFF</p><h1>Customer orders</h1><p>{accessLevel==='full'?'Full access':'View only'}</p></div>
      <div className="staff-header-actions"><button onClick={()=>void refresh()} disabled={loading}>Refresh</button>
        {!embedded && <><a href="/">Main system</a><button onClick={()=>void client.auth.signOut()}>Sign out of main system</button></>}</div></header>
    {orderingControl && <section className="staff-ordering-control" aria-label="Customer ordering availability">
      <div><strong role="status">Customer ordering is {orderingControl.enabled?'OPEN':'CLOSED'}</strong>
        <p>{orderingControl.canOpen?'New customer requests follow the published pickup hours and 3 PM next-day cutoff. Delivery requests require a staff quote and customer confirmation.':'Opening is temporarily locked by the server.'}</p>
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
        {visibleOrders.map(order=><button className={selectedId===order.id?'selected':''} key={order.id} onClick={()=>{setDetail(null);setPhoneCallConfirmed(false);setDeliveryOrigin('');setRoadKm('');setPaymentConfirmed(false);setPaymentReference('');setRefundConfirmed(false);setRefundReference('');setRefundReason('');setSelectedId(order.id);setDetailRefresh(current=>current+1)}}>
          <strong>{order.order_code}</strong><span>{order.status.replaceAll('_',' ')}</span>
          <small>{order.customer_name} · {when(order.scheduled_at)}</small>
          <small>{order.fulfillment_type} · {order.fulfillment_type==='delivery'&&!order.delivery_quoted_at?'Fee pending':money(order.total)}</small>
        </button>)}
      </section>
      <section className="staff-panel staff-detail" aria-label="Selected order">
        {!selectedDetail ? <p>{selected?'Loading order…':'Select an order.'}</p> : <>
          <div className="staff-title"><h2>{selectedDetail.order_code}</h2><span>{selectedDetail.status.replaceAll('_',' ')}</span></div>
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
              <p className="staff-hint">Verify the municipality and map pin, select the actual dispatch location, then measure the road route. Rate: ₱80 for the first 3 km plus ₱10 for each additional started km. Saving a new quote clears any earlier phone confirmation.</p>
              <label>Dispatch location<select value={deliveryOrigin} onChange={event=>setDeliveryOrigin(event.target.value)} required>
                <option value="">Select location</option>
                {deliveryOrigins.map(origin=><option key={origin.name} value={origin.name}>{origin.name}</option>)}
              </select></label>
              <label>Verified road distance (km)<input type="number" min="0" max="100" step="0.001" value={roadKm} onChange={event=>setRoadKm(event.target.value)} required /></label>
              <button disabled={busy||!deliveryOrigin||roadKm===''||Number(roadKm)<0||Number(roadKm)>100}>{busy?'Saving…':'Save delivery quote'}</button>
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
          {accessLevel==='full' && <><h3>Review</h3>
          <label>Review note<input value={statusNote} onChange={event=>setStatusNote(event.target.value)} maxLength={500} /></label>
          <div className="staff-actions">{(ACTIONS[detail.status]||[])
            .filter(action=>(action!=='out_for_delivery'||detail.fulfillment_type==='delivery')
              && (action!=='cancelled'||detail.payment_status!=='paid'))
            .map(action=><button key={action} disabled={busy||(action==='accepted'&&(!detail.phone_verified_at||(detail.fulfillment_type==='delivery'&&!detail.delivery_quoted_at)))} onClick={()=>void updateStatus(action)}>{action.replaceAll('_',' ')}</button>)}</div>
          {detail.payment_status==='unpaid' && ['accepted','preparing','ready','completed'].includes(detail.status) && <form className="staff-payment" onSubmit={recordPayment}>
            <h3>Confirm payment and record online sale</h3>
            <p className="staff-hint">Record this once, only after receiving and checking the full {money(detail.total)} payment. The sale will appear separately from the outlet POS.</p>
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
    </div>
  </main>
}
