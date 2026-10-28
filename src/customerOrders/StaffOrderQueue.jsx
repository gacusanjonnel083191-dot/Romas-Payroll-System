import {useCallback, useEffect, useMemo, useState} from 'react'
import {createClient} from '@supabase/supabase-js'
import {callStaffOrdering} from './staffApi.mjs'

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
  const [selectedId,setSelectedId] = useState('')
  const [detail,setDetail] = useState(null)
  const [detailRefresh,setDetailRefresh] = useState(0)
  const [message,setMessage] = useState('')
  const [statusNote,setStatusNote] = useState('')
  const [phoneCallConfirmed,setPhoneCallConfirmed] = useState(false)
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
  const selected = useMemo(()=>orders.find(order=>order.id===selectedId),[orders,selectedId])

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
      onOrdersChange?.(result.orders)
      setAccessLevel(result.accessLevel)
      setSelectedId(current=>result.orders.some(order=>order.id===current)
        ? current : result.orders[0]?.id || '')
      setDetail(null)
      setDetailRefresh(current=>current+1)
      setError('')
    } catch (failure) { setError(failure.message) }
    finally { setLoading(false) }
  },[request,onOrdersChange])

  useEffect(()=>{
    if(!session)return undefined
    let active=true
    request('staff-list').then(result=>{
      if(active){setAccessLevel(result.accessLevel);setOrders(result.orders);onOrdersChange?.(result.orders);setSelectedId(current=>result.orders.some(order=>order.id===current)
        ? current : result.orders[0]?.id || '')}
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

  if (!client) return <main className="staff-login"><div className="staff-panel">
    <h1>Customer orders are not configured</h1>
    <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using this staff page.</p>
  </div></main>
  if (!session) return <Login />

  return <main className={`staff-app${embedded?' staff-embedded':''}`}>
    <header><div><p className="staff-kicker">ROMA'S DONUTS · STAFF</p><h1>Customer orders</h1><p>{accessLevel==='full'?'Full access':'View only'}</p></div>
      <div className="staff-header-actions"><button onClick={()=>void refresh()} disabled={loading}>Refresh</button>
        {!embedded && <><a href="/">Main system</a><button onClick={()=>void client.auth.signOut()}>Sign out of main system</button></>}</div></header>
    {error && <p role="alert" className="staff-error">{error}</p>}
    <div className="staff-layout">
      <section className="staff-panel staff-list" aria-label="Order queue">
        <h2>Requests {loading && <small>Refreshing…</small>}</h2>
        {orders.length===0 && <p>No customer orders are available.</p>}
        {orders.map(order=><button className={selectedId===order.id?'selected':''} key={order.id} onClick={()=>{setDetail(null);setPhoneCallConfirmed(false);setPaymentConfirmed(false);setPaymentReference('');setRefundConfirmed(false);setRefundReference('');setRefundReason('');setSelectedId(order.id);setDetailRefresh(current=>current+1)}}>
          <strong>{order.order_code}</strong><span>{order.status.replaceAll('_',' ')}</span>
          <small>{order.customer_name} · {when(order.scheduled_at)}</small>
          <small>{order.fulfillment_type} · {money(order.total)}</small>
        </button>)}
      </section>
      <section className="staff-panel staff-detail" aria-label="Selected order">
        {!detail ? <p>{selected?'Loading order…':'Select an order.'}</p> : <>
          <div className="staff-title"><h2>{detail.order_code}</h2><span>{detail.status.replaceAll('_',' ')}</span></div>
          <p><strong>{detail.customer_name}</strong> · {detail.customer_phone}</p>
          {detail.phone_verified_at
            ? <p className="staff-hint" role="status">Phone confirmed by staff call on {when(detail.phone_verified_at)}.</p>
            : detail.status==='pending_confirmation' && accessLevel==='full'
              ? <form className="staff-payment" onSubmit={confirmPhoneByCall}>
                <h3>Confirm customer by phone</h3>
                <p className="staff-hint">Call {detail.customer_phone} and confirm the customer’s name, order, pickup location, and requested time before accepting.</p>
                <label className="staff-payment-confirm"><input type="checkbox" checked={phoneCallConfirmed} onChange={event=>setPhoneCallConfirmed(event.target.checked)} /> I spoke with the customer at this number and confirmed the order details.</label>
                <button disabled={busy||!phoneCallConfirmed}>{busy?'Saving…':'Record phone confirmation'}</button>
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
          <div className="staff-row"><span>Delivery</span><strong>{money(detail.delivery_fee)}</strong></div>
          <div className="staff-row staff-total"><span>Total · {detail.payment_status}</span><strong>{money(detail.total)}</strong></div>
          {detail.paid_at && <p className="staff-hint">Payment recorded {when(detail.paid_at)}. This order is linked to one separate online sale.</p>}
          {detail.refunded_at && <p className="staff-hint">Full refund recorded {when(detail.refunded_at)}. The original sale remains in the ledger, with a separate reversing entry{detail.receipt?.refund?.id? ` (${detail.receipt.refund.id})` : ''}.</p>}
          {accessLevel==='full' && <><h3>Review</h3>
          <label>Review note<input value={statusNote} onChange={event=>setStatusNote(event.target.value)} maxLength={500} /></label>
          <div className="staff-actions">{(ACTIONS[detail.status]||[])
            .filter(action=>(action!=='out_for_delivery'||detail.fulfillment_type==='delivery')
              && (action!=='cancelled'||detail.payment_status!=='paid'))
            .map(action=><button key={action} disabled={busy||(action==='accepted'&&!detail.phone_verified_at)} onClick={()=>void updateStatus(action)}>{action.replaceAll('_',' ')}</button>)}</div>
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
