import {useCallback, useEffect, useMemo, useState} from 'react'
import {createClient} from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const endpoint = url ? `${url.replace(/\/$/, '')}/functions/v1/public-ordering` : ''
const supabase = url && key ? createClient(url, key, {
  auth: {storage: window.sessionStorage, persistSession:true, autoRefreshToken:true},
}) : null
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

function signInMessage(error) {
  if (error?.status === 429) return 'Too many sign-in attempts. Please wait and try again.'
  if (error?.status === 400 && /invalid login credentials/i.test(error.message || '')) {
    return 'The staging email or password does not match. Use your temporary staging password.'
  }
  if (/fetch|network/i.test(error?.message || '')) {
    return 'Could not reach the staging sign-in service. Check your connection and try again.'
  }
  return `Sign-in failed: ${error?.message || 'unknown error'}`
}

async function call(action, payload = {}) {
  if (!supabase) throw new Error('Supabase environment variables are missing.')
  const {data:{session}} = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sign in to review orders.')
  const response = await fetch(endpoint, {
    method:'POST', headers:{
      'Content-Type':'application/json', apikey:key,
      Authorization:`Bearer ${session.access_token}`,
    }, body:JSON.stringify({action,...payload}),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || !result.ok) throw new Error(result.message || 'The ordering service is unavailable.')
  return result
}

function Login({onSignedIn}) {
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    if (!supabase || busy) return
    setBusy(true);setError('')
    const {error:signInError} = await supabase.auth.signInWithPassword({email,password})
    setPassword('')
    setBusy(false)
    if (signInError) setError(signInMessage(signInError))
    else onSignedIn()
  }
  return <main className="staff-login"><div className="staff-panel">
    <p className="staff-kicker">ROMA'S DONUTS</p><h1>Customer order queue</h1>
    <p>Sign in with your authorized business account.</p>
    <form onSubmit={submit}>
      <label>Email<input type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required /></label>
      {error && <p role="alert" className="staff-error">{error}</p>}
      <button disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
    </form>
  </div></main>
}

export default function StaffOrderQueue() {
  const [session,setSession] = useState(null)
  const [orders,setOrders] = useState([])
  const [selectedId,setSelectedId] = useState('')
  const [detail,setDetail] = useState(null)
  const [detailRefresh,setDetailRefresh] = useState(0)
  const [message,setMessage] = useState('')
  const [statusNote,setStatusNote] = useState('')
  const [paymentMethod,setPaymentMethod] = useState('Cash')
  const [paymentReference,setPaymentReference] = useState('')
  const [paymentConfirmed,setPaymentConfirmed] = useState(false)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [loading,setLoading] = useState(false)
  const selected = useMemo(()=>orders.find(order=>order.id===selectedId),[orders,selectedId])

  useEffect(()=>{
    if (!supabase) return undefined
    supabase.auth.getSession().then(({data})=>setSession(data.session))
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,next)=>setSession(next))
    return ()=>subscription.unsubscribe()
  },[])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await call('staff-list')
      setOrders(result.orders)
      setSelectedId(current=>result.orders.some(order=>order.id===current)
        ? current : result.orders[0]?.id || '')
      setDetail(null)
      setDetailRefresh(current=>current+1)
      setError('')
    } catch (failure) { setError(failure.message) }
    finally { setLoading(false) }
  },[])

  useEffect(()=>{
    if(!session)return undefined
    let active=true
    call('staff-list').then(result=>{
      if(active){setOrders(result.orders);setSelectedId(current=>result.orders.some(order=>order.id===current)
        ? current : result.orders[0]?.id || '')}
    }).catch(failure=>{if(active)setError(failure.message)})
    return ()=>{active=false}
  },[session])
  useEffect(()=>{
    if (!session || !selectedId) return undefined
    let active = true
    call('staff-get',{orderId:selectedId}).then(result=>{
      if(active){setDetail(result.order);setError('')}
    }).catch(failure=>{if(active)setError(failure.message)})
    return ()=>{active=false}
  },[session,selectedId,detailRefresh])

  async function updateStatus(status) {
    if (!detail || busy) return
    setBusy(true)
    try {
      await call('staff-status',{
        orderId:detail.id,expectedStatus:detail.status,status,note:statusNote,
      })
      setStatusNote('')
      await refresh()
      const result = await call('staff-get',{orderId:detail.id})
      setDetail(result.order)
    } catch(failure){setError(failure.message)}
    finally{setBusy(false)}
  }

  async function sendMessage(event) {
    event.preventDefault()
    if (!detail || !message.trim() || busy) return
    setBusy(true)
    try {
      await call('staff-message',{orderId:detail.id,message:message.trim()})
      setMessage('')
      const result = await call('staff-get',{orderId:detail.id})
      setDetail(result.order)
    } catch(failure){setError(failure.message)}
    finally{setBusy(false)}
  }

  async function recordPayment(event) {
    event.preventDefault()
    if (!detail || busy || !paymentConfirmed) return
    setBusy(true);setError('')
    try {
      await call('staff-pay',{
        orderId:detail.id,paymentMethod,
        referenceNumber:paymentMethod==='Cash'?'':paymentReference.trim(),
      })
      setPaymentReference('');setPaymentConfirmed(false)
      await refresh()
    } catch(failure){setError(failure.message)}
    finally{setBusy(false)}
  }

  if (!supabase) return <main className="staff-login"><div className="staff-panel">
    <h1>Customer orders are not configured</h1>
    <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using this staff page.</p>
  </div></main>
  if (!session) return <Login onSignedIn={()=>void refresh()} />

  return <main className="staff-app">
    <header><div><p className="staff-kicker">ROMA'S DONUTS · STAFF</p><h1>Customer orders</h1></div>
      <div className="staff-header-actions"><button onClick={()=>void refresh()} disabled={loading}>Refresh</button>
        <button onClick={()=>void supabase.auth.signOut()}>Sign out</button></div></header>
    {error && <p role="alert" className="staff-error">{error}</p>}
    <div className="staff-layout">
      <section className="staff-panel staff-list" aria-label="Order queue">
        <h2>Requests {loading && <small>Refreshing…</small>}</h2>
        {orders.length===0 && <p>No customer orders are available.</p>}
        {orders.map(order=><button className={selectedId===order.id?'selected':''} key={order.id} onClick={()=>{setDetail(null);setPaymentConfirmed(false);setPaymentReference('');setSelectedId(order.id);setDetailRefresh(current=>current+1)}}>
          <strong>{order.order_code}</strong><span>{order.status.replaceAll('_',' ')}</span>
          <small>{order.customer_name} · {when(order.scheduled_at)}</small>
          <small>{order.fulfillment_type} · {money(order.total)}</small>
        </button>)}
      </section>
      <section className="staff-panel staff-detail" aria-label="Selected order">
        {!detail ? <p>{selected?'Loading order…':'Select an order.'}</p> : <>
          <div className="staff-title"><h2>{detail.order_code}</h2><span>{detail.status.replaceAll('_',' ')}</span></div>
          <p><strong>{detail.customer_name}</strong> · {detail.customer_phone}</p>
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
          <h3>Review</h3>
          <label>Review note<input value={statusNote} onChange={event=>setStatusNote(event.target.value)} maxLength={500} /></label>
          <div className="staff-actions">{(ACTIONS[detail.status]||[])
            .filter(action=>(action!=='out_for_delivery'||detail.fulfillment_type==='delivery')
              && (action!=='cancelled'||detail.payment_status!=='paid'))
            .map(action=><button key={action} disabled={busy} onClick={()=>void updateStatus(action)}>{action.replaceAll('_',' ')}</button>)}</div>
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
          <h3>Order chat</h3>
          <div className="staff-messages">{detail.messages.map(item=><div key={item.id}>
            <strong>{item.sender==='staff'?'Roma’s team':'Customer'}</strong> <small>{when(item.created_at)}</small>
            <p>{item.body}</p>
          </div>)}</div>
          <form className="staff-chat" onSubmit={sendMessage}><input aria-label="Reply to customer" value={message} onChange={event=>setMessage(event.target.value)} maxLength={500} required />
            <button disabled={busy}>Send</button></form>
        </>}
      </section>
    </div>
  </main>
}
